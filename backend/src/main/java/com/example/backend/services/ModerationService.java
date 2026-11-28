package com.example.backend.services;

import com.example.backend.models.AdminAction;
import com.example.backend.models.JobCall;
import com.example.backend.models.ModerationEvidence;
import com.example.backend.models.Notification;
import com.example.backend.models.Post;
import com.example.backend.models.PostComment;
import com.example.backend.models.PostImage;
import com.example.backend.models.SecurityBan;
import com.example.backend.models.User;
import com.example.backend.repositories.AdminActionRepository;
import com.example.backend.repositories.JobCallRepository;
import com.example.backend.repositories.JobInterestRepository;
import com.example.backend.repositories.ModerationEvidenceRepository;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.PostCommentRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.SecurityBanRepository;
import com.example.backend.repositories.SecurityEventRepository;
import com.example.backend.repositories.UserRepository;
import com.example.backend.dto.PostResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Moderação pelo painel: banir (esconde tudo, bloqueia e-mail, aparelhos e IPs, congela a prova), apagar o
 * conteúdo de uma conta banida, remover uma publicação avisando o autor, a fila de aprovação das contas novas
 * e o dossiê para baixar.
 */
@Service
public class ModerationService {

    private static final Logger log = LoggerFactory.getLogger(ModerationService.class);
    static final int IP_BAN_DAYS = 90;
    static final int TRUST_AFTER_APPROVED = 3;
    static final String GUIDELINES = "por violar as diretrizes da moderação da WorkAt";

    private final AdminService admin;
    private final EvidenceService evidence;
    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final PostCommentRepository commentRepository;
    private final JobCallRepository callRepository;
    private final JobInterestRepository interestRepository;
    private final SecurityEventRepository eventRepository;
    private final SecurityBanRepository banRepository;
    private final ModerationEvidenceRepository evidenceRepository;
    private final NotificationRepository notificationRepository;
    private final AdminActionRepository actionRepository;
    private final PostService postService;
    private final PostCommentService commentService;
    private final FileStorage storage;
    private final AdminAccess adminAccess;
    private final BCryptPasswordEncoder passwordEncoder;

    public ModerationService(AdminService admin, EvidenceService evidence, UserRepository userRepository,
                             PostRepository postRepository, PostCommentRepository commentRepository,
                             JobCallRepository callRepository, JobInterestRepository interestRepository,
                             SecurityEventRepository eventRepository, SecurityBanRepository banRepository,
                             ModerationEvidenceRepository evidenceRepository,
                             NotificationRepository notificationRepository, AdminActionRepository actionRepository,
                             PostService postService, PostCommentService commentService, FileStorage storage,
                             AdminAccess adminAccess, BCryptPasswordEncoder passwordEncoder) {
        this.admin = admin;
        this.evidence = evidence;
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.callRepository = callRepository;
        this.interestRepository = interestRepository;
        this.eventRepository = eventRepository;
        this.banRepository = banRepository;
        this.evidenceRepository = evidenceRepository;
        this.notificationRepository = notificationRepository;
        this.actionRepository = actionRepository;
        this.postService = postService;
        this.commentService = commentService;
        this.storage = storage;
        this.adminAccess = adminAccess;
        this.passwordEncoder = passwordEncoder;
    }

    // ---- Banir ----

    /**
     * Banir: definitivo e sem apagar nada (o conteúdo some do público e fica como prova). Bloqueia o e-mail e os
     * aparelhos para sempre e os IPs usados nos últimos 90 dias por 90 dias. Congela a prova antes de tudo.
     */
    @Transactional
    public void ban(User adminUser, Long id, String reason, String password) {
        admin.requireAdmin(adminUser);
        checkPassword(adminUser, password);
        User user = target(adminUser, id);
        if (user.isBanned()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Essa conta já foi banida.");
        }
        String why = reason(reason);
        evidence.freeze(user, "BAN", why, adminUser.getEmail(), null);

        LocalDateTime now = LocalDateTime.now();
        int ips = 0, devices = 0;
        if (user.getEmail() != null) {
            addBan(SecurityBan.Kind.EMAIL, user.getEmail().trim().toLowerCase(Locale.ROOT), user, why, null);
        }
        for (String device : eventRepository.devicesOf(user.getId())) {
            addBan(SecurityBan.Kind.DEVICE, device, user, why, null);
            devices++;
        }
        for (String ip : eventRepository.ipsOf(user.getId(), now.minusDays(IP_BAN_DAYS))) {
            addBan(SecurityBan.Kind.IP, ip, user, why, now.plusDays(IP_BAN_DAYS));
            ips++;
        }
        user.setBanned(true);
        user.setBannedAt(now);
        user.setBanReason(why);
        user.setSuspended(false);
        user.setSuspendedUntil(null);
        user.setAvailableForWork(false);
        userRepository.save(user);
        record(adminUser, "BAN", "USER", user.getId(), label(user), why,
                "e-mail, " + devices + " aparelho(s) e " + ips + " IP(s) bloqueados; prova congelada");
    }

    /**
     * Apaga o conteúdo de uma conta já banida para liberar espaço (publicações e imagens, comentários, Chamadas e
     * candidaturas). Antes, congela mais uma prova com o hash de cada imagem. Pede a senha.
     */
    @Transactional
    public void purgeContent(User adminUser, Long id, String password) {
        admin.requireAdmin(adminUser);
        checkPassword(adminUser, password);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta não encontrada."));
        if (!user.isBanned()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Só dá para apagar o conteúdo de uma conta banida.");
        }
        evidence.freeze(user, "PURGE", "conteúdo apagado para liberar espaço", adminUser.getEmail(), null);
        int posts = 0, comments = 0, calls = 0;
        for (Post post : postRepository.findByAuthorOrderByIdDesc(user)) {
            postService.delete(post.getId(), user);
            posts++;
        }
        for (PostComment comment : commentRepository.findByAuthor(user)) {
            try {
                commentService.delete(comment.getId(), user);
                comments++;
            } catch (RuntimeException e) {
                log.warn("Apagar conteúdo: comentário {} ficou: {}", comment.getId(), e.getMessage());
            }
        }
        for (JobCall call : callRepository.findByAuthorOrderByIdDesc(user)) {
            interestRepository.deleteAll(interestRepository.findByCallOrderByIdAsc(call));
            callRepository.delete(call);
            calls++;
        }
        interestRepository.deleteAll(interestRepository.findByArtistOrderByIdDesc(user));
        storage.delete(user.getAvatarStoredName());
        storage.delete(user.getBannerStoredName());
        storage.delete(user.getAvatarOriginalStoredName());
        storage.delete(user.getBannerOriginalStoredName());
        user.setAvatarStoredName(null);
        user.setAvatarContentType(null);
        user.setAvatarOriginalStoredName(null);
        user.setBannerStoredName(null);
        user.setBannerContentType(null);
        user.setBannerOriginalStoredName(null);
        userRepository.save(user);
        record(adminUser, "PURGE", "USER", user.getId(), label(user), null,
                posts + " publicações, " + comments + " comentários e " + calls + " Chamadas apagadas");
    }

    // ---- Publicações ----

    /** Remove uma publicação, congela a prova e avisa o autor de que ela quebrou as diretrizes. */
    @Transactional
    public void removePost(User adminUser, Long postId, String reason) {
        admin.requireAdmin(adminUser);
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Publicação não encontrada."));
        String why = reason(reason);
        User author = post.getAuthor();
        evidence.freeze(author, "REMOVE_POST", why, adminUser.getEmail(), post);
        String title = post.getTitle() != null ? post.getTitle() : "sem título";
        postService.delete(post.getId(), author);
        notify(author, "MODERATION_REMOVED", "Sua publicação \"" + title + "\" foi removida " + GUIDELINES
                + ". Motivo: " + why, "/notificacoes");
        record(adminUser, "REMOVE_POST", "POST", postId, "\"" + title + "\" de " + label(author), why, null);
    }

    /** Fila de aprovação: publicações de contas novas, da mais antiga para a mais nova. */
    @Transactional(readOnly = true)
    public List<PostResponse> queue(User adminUser) {
        admin.requireAdmin(adminUser);
        return postService.toResponses(postRepository.findByPendingReviewTrueOrderByIdAsc().stream()
                .filter(post -> post.getAuthor() == null || !post.getAuthor().isBlocked())
                .toList(), adminUser);
    }

    /** Aprova: a publicação vai ao ar. Depois de 3 aprovadas, a conta passa a publicar direto. */
    @Transactional
    public void approvePost(User adminUser, Long postId) {
        admin.requireAdmin(adminUser);
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Publicação não encontrada."));
        if (!post.isPendingReview()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Essa publicação já está no ar.");
        }
        post.setPendingReview(false);
        postRepository.save(post);
        User author = post.getAuthor();
        String title = post.getTitle() != null ? post.getTitle() : "sem título";
        notify(author, "MODERATION_APPROVED", "Sua publicação \"" + title + "\" foi aprovada e já está no ar.",
                "/publicacao/" + post.getId());
        record(adminUser, "APPROVE", "POST", postId, "\"" + title + "\" de " + label(author), null, null);
        if (!author.isTrusted() && postRepository.countByAuthorAndPendingReviewFalse(author) >= TRUST_AFTER_APPROVED) {
            author.setTrusted(true);
            userRepository.save(author);
            record(adminUser, "TRUST", "USER", author.getId(), label(author), null,
                    TRUST_AFTER_APPROVED + " publicações aprovadas");
        }
    }

    /** Confiar na conta: publica direto daqui em diante, e o que estava esperando vai ao ar. */
    @Transactional
    public void trust(User adminUser, Long id) {
        admin.requireAdmin(adminUser);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta não encontrada."));
        user.setTrusted(true);
        userRepository.save(user);
        int approved = 0;
        for (Post post : postRepository.findByAuthorOrderByIdDesc(user)) {
            if (post.isPendingReview()) {
                post.setPendingReview(false);
                postRepository.save(post);
                approved++;
            }
        }
        record(adminUser, "TRUST", "USER", user.getId(), label(user), null,
                approved + " publicação(ões) pendente(s) aprovada(s)");
    }

    // ---- Dossiê ----

    /**
     * Dossiê em ZIP: dossie.json (retrato atual), cada prova congelada, verificacao.txt com o SHA-256 de cada
     * arquivo e, se pedido, as imagens que ainda existirem.
     */
    @Transactional
    public byte[] dossier(User adminUser, Long id, boolean includeImages) {
        admin.requireAdmin(adminUser);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta não encontrada."));
        Map<String, Object> current = new LinkedHashMap<>();
        current.put("geradoEm", LocalDateTime.now());
        current.put("geradoPor", adminUser.getEmail());
        current.putAll(evidence.account(user));
        byte[] currentJson = evidence.write(current).getBytes(StandardCharsets.UTF_8);
        List<String> checks = new ArrayList<>();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            put(zip, "dossie.json", currentJson, checks);
            for (ModerationEvidence frozen : evidenceRepository.findByUserIdOrderByIdAsc(user.getId())) {
                String name = "provas/" + frozen.getId() + "-" + frozen.getAction().toLowerCase(Locale.ROOT) + ".json";
                put(zip, name, frozen.getSnapshot().getBytes(StandardCharsets.UTF_8), checks);
                checks.add("  (gravado no banco em " + frozen.getCreatedAt() + " com SHA-256 " + frozen.getSha256() + ")");
            }
            if (includeImages) {
                for (Post post : postRepository.findByAuthorOrderByIdDesc(user)) {
                    for (PostImage image : post.getImages()) {
                        String stored = EvidenceService.storedNameOf(image);
                        Optional<Resource> resource = evidence.load(stored);
                        if (resource.isEmpty()) {
                            continue;
                        }
                        try (InputStream input = resource.get().getInputStream()) {
                            String extension = stored.contains(".") ? stored.substring(stored.lastIndexOf('.')) : "";
                            put(zip, "imagens/publicacao-" + post.getId() + "-imagem-" + image.getId() + extension,
                                    input.readAllBytes(), checks);
                        }
                    }
                }
            }
            String header = "Dossiê da conta @" + user.getUsername() + " (id " + user.getId() + ")\n"
                    + "Gerado em " + LocalDateTime.now() + " por " + adminUser.getEmail() + "\n"
                    + "SHA-256 de cada arquivo deste ZIP (confira com: certutil -hashfile <arquivo> SHA256):\n\n";
            put(zip, "verificacao.txt", (header + String.join("\n", checks) + "\n").getBytes(StandardCharsets.UTF_8), null);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não deu para montar o dossiê.");
        }
        record(adminUser, "DOSSIER", "USER", user.getId(), label(user), null,
                includeImages ? "com imagens" : "sem imagens");
        return bytes.toByteArray();
    }

    // ---- Regras internas ----

    private static void put(ZipOutputStream zip, String name, byte[] content, List<String> checks) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content);
        zip.closeEntry();
        if (checks != null) {
            checks.add(EvidenceService.sha256(content) + "  " + name);
        }
    }

    private void addBan(SecurityBan.Kind kind, String value, User source, String reason, LocalDateTime expiresAt) {
        if (value == null || value.isBlank()) {
            return;
        }
        SecurityBan ban = new SecurityBan();
        ban.setKind(kind);
        ban.setValue(value.length() > 160 ? value.substring(0, 160) : value);
        ban.setSourceUserId(source.getId());
        ban.setSourceUsername(source.getUsername());
        ban.setReason(reason);
        ban.setExpiresAt(expiresAt);
        banRepository.save(ban);
    }

    private void checkPassword(User adminUser, String password) {
        if (password == null || !passwordEncoder.matches(password, adminUser.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Senha incorreta.");
        }
    }

    private User target(User adminUser, Long id) {
        User user = userRepository.findById(id).filter(found -> !found.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta não encontrada."));
        if (ProjectAccessService.sameUser(user, adminUser)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Você não pode suspender nem banir a própria conta.");
        }
        if (adminAccess.isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Outro administrador só sai da lista pelo servidor.");
        }
        return user;
    }

    private static String reason(String reason) {
        String text = reason == null ? "" : reason.trim();
        if (text.length() < 3 || text.length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escreva o motivo (de 3 a 500 caracteres).");
        }
        return text;
    }

    private void notify(User to, String type, String message, String link) {
        if (to == null) {
            return;
        }
        Notification notification = new Notification();
        notification.setUser(to);
        notification.setType(type);
        notification.setMessage(message.length() > 480 ? message.substring(0, 477) + "..." : message);
        notification.setLink(link);
        notificationRepository.save(notification);
    }

    private void record(User adminUser, String type, String targetType, Long targetId, String label, String reason,
                        String detail) {
        AdminAction action = new AdminAction();
        action.setAdminEmail(adminUser.getEmail());
        action.setAction(type);
        action.setTargetType(targetType);
        action.setTargetId(targetId);
        action.setTargetLabel(label == null ? null : (label.length() > 200 ? label.substring(0, 200) : label));
        action.setReason(reason);
        action.setDetail(detail);
        actionRepository.save(action);
    }

    private static String label(User user) {
        return user == null ? "conta removida" : "@" + user.getUsername() + " · " + user.getFullName();
    }
}
