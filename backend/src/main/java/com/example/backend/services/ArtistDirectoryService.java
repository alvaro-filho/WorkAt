package com.example.backend.services;

import com.example.backend.config.BusinessTime;
import com.example.backend.dto.ArtistDtos.ArtistCard;
import com.example.backend.dto.ArtistDtos.Availability;
import com.example.backend.dto.ProfileResponse;
import com.example.backend.dto.UserSummary;
import com.example.backend.models.JobCall;
import com.example.backend.models.Notification;
import com.example.backend.models.Post;
import com.example.backend.models.Role;
import com.example.backend.models.User;
import com.example.backend.repositories.JobCallRepository;
import com.example.backend.repositories.JobInterestRepository;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Diretório de artistas: Explorar › Artistas (filtro por função e "só disponíveis") e as sugestões que o estúdio
 * vê na própria Chamada, com "Chamar para ver a Chamada" (uma vez por artista e Chamada, até 20 por Chamada).
 * Só entra quem tem ao menos um trabalho público com imagem: o Explorar continua visual.
 */
@Service
public class ArtistDirectoryService {

    static final int MAX_RESULTS = 60;
    static final int WORKS_PER_CARD = 3;
    static final int MAX_SUGGESTIONS = 12;
    static final int MAX_NUDGES_PER_CALL = 20;

    /** Palavras das especialidades (texto livre do perfil) que contam para cada função da Chamada. */
    static final Map<JobCall.Role, List<String>> ROLE_WORDS = Map.of(
            JobCall.Role.CONCEPT, List.of("concept"),
            JobCall.Role.ILUSTRACAO, List.of("ilustra", "illustra"),
            JobCall.Role.MODELAGEM_3D, List.of("3d", "modelag", "model", "escult", "sculpt", "blender"),
            JobCall.Role.ANIMACAO, List.of("anima", "motion"),
            JobCall.Role.HQ, List.of("hq", "quadrinho", "comic", "manga"),
            JobCall.Role.UI, List.of("ui", "ux", "interface"));

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final PostService postService;
    private final JobCallRepository callRepository;
    private final JobInterestRepository interestRepository;
    private final NotificationRepository notificationRepository;

    public ArtistDirectoryService(UserRepository userRepository, PostRepository postRepository, PostService postService,
                                  JobCallRepository callRepository, JobInterestRepository interestRepository,
                                  NotificationRepository notificationRepository) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.postService = postService;
        this.callRepository = callRepository;
        this.interestRepository = interestRepository;
        this.notificationRepository = notificationRepository;
    }

    /** Explorar › Artistas: disponíveis primeiro (mais recentes no topo), depois quem publicou por último. */
    @Transactional(readOnly = true)
    public List<ArtistCard> explore(JobCall.Role role, boolean onlyAvailable, User viewer) {
        return userRepository.findByRoleAndDeletedFalse(Role.ARTIST).stream()
                .filter(artist -> !onlyAvailable || artist.isAvailableForWork())
                .filter(artist -> matchesRole(artist.getSpecialties(), role))
                .map(artist -> new Ranked(artist, works(artist)))
                .filter(ranked -> !ranked.works.isEmpty())
                .sorted(RANKING)
                .limit(MAX_RESULTS)
                .map(ranked -> card(ranked, viewer, false))
                .toList();
    }

    /** Sugestões na Chamada (só o autor): disponíveis com a função dela que ainda não mostraram interesse. */
    @Transactional(readOnly = true)
    public List<ArtistCard> suggestions(Long callId, User user) {
        JobCall call = authoredCall(callId, user);
        Set<Long> interested = interestRepository.findByCallOrderByIdAsc(call).stream()
                .map(interest -> interest.getArtist().getId())
                .collect(Collectors.toSet());
        String key = nudgeKey(call);
        return userRepository.findByRoleAndDeletedFalse(Role.ARTIST).stream()
                .filter(User::isAvailableForWork)
                .filter(artist -> !interested.contains(artist.getId()))
                .filter(artist -> matchesRole(artist.getSpecialties(), call.getRole()))
                .map(artist -> new Ranked(artist, works(artist)))
                .filter(ranked -> !ranked.works.isEmpty())
                .sorted(RANKING)
                .limit(MAX_SUGGESTIONS)
                .map(ranked -> card(ranked, user, notificationRepository.existsByUserAndRefKey(ranked.artist, key)))
                .toList();
    }

    /** "Chamar para ver a Chamada": um aviso para o artista, uma vez por Chamada, com a Chamada aberta. */
    @Transactional
    public void nudge(Long callId, String username, User user) {
        JobCall call = authoredCall(callId, user);
        if (!call.isOpen(BusinessTime.today())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Só dá para chamar artistas com a Chamada aberta.");
        }
        User artist = userRepository.findByUsername(username).filter(found -> !found.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artista não encontrado."));
        if (artist.getRole() != Role.ARTIST || !artist.isAvailableForWork()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Essa pessoa não está disponível para trabalho.");
        }
        if (interestRepository.findByCallAndArtist(call, artist).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Essa pessoa já mostrou interesse na Chamada.");
        }
        String key = nudgeKey(call);
        if (notificationRepository.existsByUserAndRefKey(artist, key)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Você já chamou essa pessoa para esta Chamada.");
        }
        if (notificationRepository.countByRefKey(key) >= MAX_NUDGES_PER_CALL) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Você já chamou " + MAX_NUDGES_PER_CALL + " artistas para esta Chamada.");
        }
        Notification notification = new Notification();
        notification.setUser(artist);
        notification.setType("CALL_NUDGE");
        String message = user.getFullName() + " acha que você combina com a Chamada \"" + call.getTitle() + "\". Dê uma olhada.";
        notification.setMessage(message.length() > 480 ? message.substring(0, 480) : message);
        notification.setLink("/chamadas/" + call.getId());
        notification.setRefKey(key);
        notificationRepository.save(notification);
    }

    // ---- Regras internas ----

    private record Ranked(User artist, List<Post> works) {
    }

    /** Disponíveis primeiro (o selo ligado mais recente no topo); depois, quem publicou por último. */
    private static final Comparator<Ranked> RANKING = Comparator
            .comparing((Ranked ranked) -> !ranked.artist.isAvailableForWork())
            .thenComparing(ranked -> ranked.artist.isAvailableForWork() && ranked.artist.getAvailableUpdatedAt() != null
                    ? ranked.artist.getAvailableUpdatedAt() : LocalDateTime.MIN, Comparator.reverseOrder())
            .thenComparing(ranked -> ranked.works.get(0).getId(), Comparator.reverseOrder());

    /** Até três trabalhos públicos com imagem, do mais novo para o mais antigo (fora os tirados do portfólio). */
    private List<Post> works(User artist) {
        return postRepository.findByAuthorOrderByIdDesc(artist).stream()
                .filter(PostService::isPublic)
                .filter(post -> !post.isHiddenFromPortfolio())
                .filter(post -> post.getImages() != null && !post.getImages().isEmpty())
                .limit(WORKS_PER_CARD)
                .toList();
    }

    private ArtistCard card(Ranked ranked, User viewer, boolean nudged) {
        User artist = ranked.artist;
        return new ArtistCard(UserSummary.from(artist), ProfileResponse.split(artist.getSpecialties(), ","),
                Availability.publicOf(artist), postService.toResponses(ranked.works, viewer), artist.getCreatedAt(),
                nudged);
    }

    private JobCall authoredCall(Long callId, User user) {
        JobCall call = callRepository.findById(callId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chamada não encontrada."));
        if (!ProjectAccessService.sameUser(call.getAuthor(), user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só quem publicou a Chamada pode fazer isso.");
        }
        return call;
    }

    private static String nudgeKey(JobCall call) {
        return "call-nudge:" + call.getId();
    }

    /** As especialidades (texto livre, separado por vírgula) batem com a função? Sem função = todos. */
    static boolean matchesRole(String specialties, JobCall.Role role) {
        if (role == null || role == JobCall.Role.OUTRO) {
            return true;
        }
        if (specialties == null || specialties.isBlank()) {
            return false;
        }
        List<String> keys = ROLE_WORDS.getOrDefault(role, List.of());
        String plain = Normalizer.normalize(specialties, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        for (String word : plain.split("[^a-z0-9]+")) {
            if (word.isEmpty()) {
                continue;
            }
            for (String key : keys) {
                boolean shortKey = key.length() <= 2;
                if (shortKey ? word.equals(key) : word.startsWith(key)) {
                    return true;
                }
            }
        }
        return false;
    }
}
