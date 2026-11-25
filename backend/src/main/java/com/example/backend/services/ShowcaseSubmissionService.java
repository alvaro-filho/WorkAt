package com.example.backend.services;

import com.example.backend.models.NdaStatus;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectType;
import com.example.backend.models.ShowcaseArt;
import com.example.backend.models.Task;
import com.example.backend.models.TaskFile;
import com.example.backend.models.User;
import com.example.backend.repositories.ShowcaseArtRepository;
import com.example.backend.repositories.TaskFileRepository;
import com.example.backend.repositories.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Fluxo novo da vitrine: a arte sai da imagem final de uma tarefa.
 * Com NDA ligado no projeto corporativo, nasce travada e só o dono do projeto (parte contratante) libera.
 * Sem NDA, é publicada direto.
 */
@Service
public class ShowcaseSubmissionService {

    private final ProjectAccessService access;
    private final TaskRepository taskRepository;
    private final TaskFileRepository fileRepository;
    private final ShowcaseArtRepository artRepository;
    private final TaskFileService taskFileService;

    public ShowcaseSubmissionService(ProjectAccessService access, TaskRepository taskRepository,
                                     TaskFileRepository fileRepository, ShowcaseArtRepository artRepository,
                                     TaskFileService taskFileService) {
        this.access = access;
        this.taskRepository = taskRepository;
        this.fileRepository = fileRepository;
        this.artRepository = artRepository;
        this.taskFileService = taskFileService;
    }

    /** Envia (ou reenvia) a imagem final da tarefa para a vitrine. Uma arte por tarefa. */
    @Transactional
    public ShowcaseArt submitFromTask(Long taskId, User user, String title, String description) {
        Task task = findVisibleTask(taskId, user);
        access.ensureCanWorkOnTask(task, user);
        access.ensureActive(task.getProject());

        TaskFile finalImage = fileRepository.findByTaskOrderByVersionDesc(task).stream()
                .filter(TaskFile::isFinalImage)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Marque uma imagem final na tarefa antes de enviar para a vitrine."));

        String cleanTitle = title == null || title.isBlank() ? task.getTitle() : title.trim();
        if (cleanTitle.length() > 150) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O título deve ter no máximo 150 caracteres.");
        }

        Project project = task.getProject();
        ShowcaseArt art = artRepository.findFirstByTask(task).orElseGet(ShowcaseArt::new);
        if (art.getId() != null && art.getNdaStatus() == NdaStatus.APPROVED_FOR_RELEASE
                && art.getSourceFile() != null && art.getSourceFile().getId().equals(finalImage.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta imagem já está publicada na vitrine.");
        }
        art.setTitle(cleanTitle);
        art.setDescription(description == null || description.isBlank() ? null : description.trim());
        art.setImageUrl(null);
        art.setArtist(user);
        art.setCompany(project.getCreatedByUser());
        art.setProject(project);
        art.setTask(task);
        art.setSourceFile(finalImage);
        art.setReviewNote(null);
        art.setReleaseDate(null);
        art.setNdaStatus(requiresNda(project) ? NdaStatus.LOCKED_BY_NDA : NdaStatus.APPROVED_FOR_RELEASE);
        art.setApprovedAt(art.getNdaStatus() == NdaStatus.APPROVED_FOR_RELEASE ? java.time.LocalDateTime.now() : null);
        return artRepository.save(art);
    }

    @Transactional(readOnly = true)
    public Optional<ShowcaseArt> forTask(Long taskId, User user) {
        return artRepository.findFirstByTask(findVisibleTask(taskId, user));
    }

    /** Artes do projeto: o dono vê todas (para aprovar); membros veem só as suas. */
    @Transactional(readOnly = true)
    public List<ShowcaseArt> forProject(Long projectId, User user) {
        Project project = access.requireParticipant(projectId, user);
        List<ShowcaseArt> arts = artRepository.findByProjectOrderByCreatedAtDesc(project);
        if (ProjectAccessService.isOwner(project, user)) {
            return arts;
        }
        return arts.stream().filter(art -> ProjectAccessService.sameUser(art.getArtist(), user)).toList();
    }

    /**
     * Imagem de uma arte. Liberada e com data já alcançada: qualquer pessoa vê.
     * Travada: só o artista e a parte contratante (com login).
     */
    @Transactional(readOnly = true)
    public ImageContent image(Long artId, User viewerOrNull) {
        ShowcaseArt art = artRepository.findById(artId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Arte não encontrada."));
        boolean allowed = isPublic(art)
                || ProjectAccessService.sameUser(art.getArtist(), viewerOrNull)
                || ProjectAccessService.sameUser(art.getCompany(), viewerOrNull);
        if (!allowed || art.getSourceFile() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Imagem não encontrada.");
        }
        Path path = taskFileService.pathOf(art.getSourceFile());
        if (!Files.exists(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Imagem não encontrada.");
        }
        return new ImageContent(path, art.getSourceFile().getContentType(), art.getSourceFile().getSizeBytes(),
                isPublic(art));
    }

    public static boolean isPublic(ShowcaseArt art) {
        return art.getNdaStatus() == NdaStatus.APPROVED_FOR_RELEASE
                && (art.getReleaseDate() == null || !art.getReleaseDate().isAfter(LocalDate.now()));
    }

    private static boolean requiresNda(Project project) {
        return project.getType() == ProjectType.CORPORATE && project.isNdaEnabled();
    }

    private Task findVisibleTask(Long taskId, User user) {
        return taskRepository.findById(taskId)
                .filter(task -> access.canSeeTask(task, user))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarefa não encontrada."));
    }

    public record ImageContent(Path path, String contentType, long sizeBytes, boolean isPublic) {
    }
}
