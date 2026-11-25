package com.example.backend.services;

import com.example.backend.dto.NdaStatusUpdateRequest;
import com.example.backend.dto.ShowcaseCreateRequest;
import com.example.backend.models.NdaStatus;
import com.example.backend.models.Project;
import com.example.backend.models.Role;
import com.example.backend.models.ShowcaseArt;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.ShowcaseArtRepository;
import com.example.backend.repositories.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@Service
public class ShowcaseService {
    private final ShowcaseArtRepository showcaseArtRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;

    public ShowcaseService(ShowcaseArtRepository showcaseArtRepository, UserRepository userRepository,
                           ProjectRepository projectRepository) {
        this.showcaseArtRepository = showcaseArtRepository;
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
    }

    @Transactional
    public ShowcaseArt create(ShowcaseCreateRequest request, User artist) {
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O título é obrigatório.");
        }
        if (request.getTitle().trim().length() > 150) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O título deve ter no máximo 150 caracteres.");
        }
        String imageUrl = request.getImageUrl();
        if (imageUrl != null && !imageUrl.isBlank()
                && (!imageUrl.matches("^https?://.+") || imageUrl.length() > 500)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A URL da imagem deve começar com http:// ou https:// e ter no máximo 500 caracteres.");
        }
        User company = userRepository.findByEmail(request.getCompanyEmail())
                .filter(user -> user.getRole() == Role.COMPANY)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Empresa contratante não encontrada."));

        Project project = null;
        if (request.getProjectId() != null) {
            project = projectRepository.findByIdAndCreatedByUser(request.getProjectId(), artist)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado."));
        }

        ShowcaseArt art = new ShowcaseArt();
        art.setTitle(request.getTitle().trim());
        art.setDescription(request.getDescription());
        art.setImageUrl(imageUrl == null || imageUrl.isBlank() ? null : imageUrl.trim());
        art.setArtist(artist);
        art.setCompany(company);
        art.setProject(project);
        art.setNdaStatus(NdaStatus.LOCKED_BY_NDA);
        return showcaseArtRepository.save(art);
    }

    @Transactional(readOnly = true)
    public List<ShowcaseArt> mine(User artist) {
        return showcaseArtRepository.findByArtistOrderByCreatedAtDesc(artist);
    }

    @Transactional(readOnly = true)
    public List<ShowcaseArt> inbox(User company) {
        return showcaseArtRepository.findByCompanyOrderByCreatedAtDesc(company);
    }

    @Transactional
    public ShowcaseArt updateNdaStatus(Long id, NdaStatusUpdateRequest request, User company) {
        ShowcaseArt art = showcaseArtRepository.findByIdAndCompany(id, company)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Arte não encontrada."));
        if (request.getStatus() == null || request.getStatus().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O status é obrigatório.");
        }

        NdaStatus status;
        try {
            status = NdaStatus.valueOf(request.getStatus());
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status inválido.");
        }

        if (status == NdaStatus.APPROVED_FOR_RELEASE) {
            if (request.getReleaseDate() != null && request.getReleaseDate().isBefore(LocalDate.now())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A data de liberação não pode ser anterior a hoje.");
            }
            art.setNdaStatus(status);
            art.setReleaseDate(request.getReleaseDate());
            art.setReviewNote(null);
            art.setApprovedAt(java.time.LocalDateTime.now());
        } else {
            if (request.getNote() == null || request.getNote().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Informe uma justificativa para recusar ou travar a arte.");
            }
            art.setNdaStatus(status);
            art.setReleaseDate(null);
            art.setReviewNote(request.getNote().trim());
            art.setApprovedAt(null);
        }
        return showcaseArtRepository.save(art);
    }

    @Transactional(readOnly = true)
    public List<ShowcaseArt> publicArts() {
        // Feed do Explorar: mais recente primeiro, pela hora em que a arte ficou pública.
        return showcaseArtRepository.findPublicArts(NdaStatus.APPROVED_FOR_RELEASE, LocalDate.now()).stream()
                .sorted(java.util.Comparator.comparing(ShowcaseArt::getPublishedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .toList();
    }
}
