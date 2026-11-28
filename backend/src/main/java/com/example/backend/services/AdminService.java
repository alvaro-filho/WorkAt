package com.example.backend.services;

import com.example.backend.config.BusinessTime;
import com.example.backend.dto.AdminDtos.ActionRow;
import com.example.backend.dto.AdminDtos.Meter;
import com.example.backend.dto.AdminDtos.Overview;
import com.example.backend.dto.AdminDtos.ProjectRow;
import com.example.backend.dto.AdminDtos.UserCounts;
import com.example.backend.dto.AdminDtos.UserDetail;
import com.example.backend.dto.AdminDtos.UserRow;
import com.example.backend.dto.ProfileResponse;
import com.example.backend.models.AdminAction;
import com.example.backend.models.InvitationStatus;
import com.example.backend.models.JobCall;
import com.example.backend.models.Post;
import com.example.backend.models.PostComment;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.Role;
import com.example.backend.models.User;
import com.example.backend.repositories.AdminActionRepository;
import com.example.backend.repositories.JobCallRepository;
import com.example.backend.repositories.JobInterestRepository;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.PostCommentRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.ProjectInvitationRepository;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskFileRepository;
import com.example.backend.repositories.UserRepository;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Painel de administração (só os e-mails de ARTHUB_ADMIN_EMAILS): visão geral, contas, suspender, reativar,
 * banir e cota por pessoa. Toda ação vai para o registro (admin_action). Conteúdo de projetos privados e sob NDA
 * fica fechado: o painel mostra só nome, tipo, membros e tamanho.
 */
@Service
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);
    static final int MAX_SUSPENSION_DAYS = 365;
    static final int MAX_QUOTA_MB = 10_240;

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;
    private final TaskFileRepository fileRepository;
    private final JobCallRepository callRepository;
    private final JobInterestRepository interestRepository;
    private final PostCommentRepository commentRepository;
    private final NotificationRepository notificationRepository;
    private final ProjectInvitationRepository invitationRepository;
    private final AdminActionRepository actionRepository;
    private final PostService postService;
    private final PostCommentService commentService;
    private final ProjectService projectService;
    private final ProjectMembershipService membershipService;
    private final TaskFileService fileService;
    private final FileStorage storage;
    private final AdminAccess adminAccess;
    private final BCryptPasswordEncoder passwordEncoder;
    private final long bucketLimitBytes;
    private final long dbLimitBytes;
    private EntityManager entityManager;

    public AdminService(UserRepository userRepository, PostRepository postRepository,
                        ProjectRepository projectRepository, ProjectMemberRepository memberRepository,
                        TaskFileRepository fileRepository, JobCallRepository callRepository,
                        JobInterestRepository interestRepository, PostCommentRepository commentRepository,
                        NotificationRepository notificationRepository,
                        ProjectInvitationRepository invitationRepository, AdminActionRepository actionRepository,
                        PostService postService, PostCommentService commentService, ProjectService projectService,
                        ProjectMembershipService membershipService, TaskFileService fileService,
                        FileStorage storage, AdminAccess adminAccess, BCryptPasswordEncoder passwordEncoder,
                        @Value("${app.admin.bucket-limit-mb:1024}") long bucketLimitMb,
                        @Value("${app.admin.db-limit-mb:512}") long dbLimitMb) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
        this.fileRepository = fileRepository;
        this.callRepository = callRepository;
        this.interestRepository = interestRepository;
        this.commentRepository = commentRepository;
        this.notificationRepository = notificationRepository;
        this.invitationRepository = invitationRepository;
        this.actionRepository = actionRepository;
        this.postService = postService;
        this.commentService = commentService;
        this.projectService = projectService;
        this.membershipService = membershipService;
        this.fileService = fileService;
        this.storage = storage;
        this.adminAccess = adminAccess;
        this.passwordEncoder = passwordEncoder;
        this.bucketLimitBytes = bucketLimitMb * 1024L * 1024L;
        this.dbLimitBytes = dbLimitMb * 1024L * 1024L;
    }

    /** Opcional (testes constroem o serviço sem eles): provas e registro de acesso. */
    private EvidenceService evidence;
    private com.example.backend.repositories.SecurityEventRepository eventRepository;
    private com.example.backend.repositories.SecurityBanRepository banRepository;
    private com.example.backend.repositories.ModerationEvidenceRepository evidenceRepository;

    @Autowired(required = false)
    public void setSecurity(EvidenceService evidence,
                            com.example.backend.repositories.SecurityEventRepository eventRepository,
                            com.example.backend.repositories.SecurityBanRepository banRepository,
                            com.example.backend.repositories.ModerationEvidenceRepository evidenceRepository) {
        this.evidence = evidence;
        this.eventRepository = eventRepository;
        this.banRepository = banRepository;
        this.evidenceRepository = evidenceRepository;
    }

    /** Opcional: mede o tamanho do banco (os testes constroem o serviço sem ele). */
    @Autowired(required = false)
    public void setEntityManager(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** Quem não é administrador nem fica sabendo que o painel existe: "não encontrado". */
    public void requireAdmin(User user) {
        if (!adminAccess.isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Página não encontrada.");
        }
    }

    // ---- Visão geral ----

    @Transactional(readOnly = true)
    public Overview overview(User admin) {
        requireAdmin(admin);
        List<User> accounts = userRepository.findAll().stream().filter(user -> !user.isDeleted()).toList();
        LocalDateTime monthAgo = LocalDateTime.now().minusDays(30);
        UserCounts counts = new UserCounts(
                accounts.size(),
                accounts.stream().filter(user -> user.getRole() == Role.ARTIST).count(),
                accounts.stream().filter(user -> user.getRole() == Role.COMPANY).count(),
                accounts.stream().filter(user -> !user.isBanned() && user.isBlocked()).count(),
                accounts.stream().filter(User::isBanned).count(),
                accounts.stream().filter(user -> user.getCreatedAt() != null && user.getCreatedAt().isAfter(monthAgo)).count());
        long stored = fileRepository.totalBytes() + fileRepository.totalPostBytes();
        List<UserRow> recent = accounts.stream()
                .sorted(Comparator.comparing(User::getId, Comparator.reverseOrder()))
                .limit(5)
                .map(this::row)
                .toList();
        return new Overview(counts, postRepository.count(), postRepository.countByPendingReviewTrue(),
                projectRepository.count(),
                callRepository.findOpen(BusinessTime.today()).size(),
                new Meter(stored, bucketLimitBytes), new Meter(databaseBytes(), dbLimitBytes),
                (int) (fileService.quotaBytes() / (1024 * 1024)), recent,
                actionRepository.findAllByOrderByIdDesc(PageRequest.of(0, 5)).stream().map(AdminService::row).toList());
    }

    // ---- Contas ----

    /** status: all, active, suspended, banned; role: ARTIST, COMPANY; sort: recent (cadastro) ou space. */
    @Transactional(readOnly = true)
    public List<UserRow> users(User admin, String query, String status, String role, String sort) {
        requireAdmin(admin);
        List<String> words = words(query);
        Comparator<UserRow> order = "space".equals(sort)
                ? Comparator.comparingLong(UserRow::usedBytes).reversed()
                : Comparator.comparing(UserRow::id, Comparator.reverseOrder());
        return userRepository.findAll().stream()
                .filter(user -> !user.isDeleted())
                .filter(user -> role == null || role.isBlank() || user.getRole().name().equals(role))
                .filter(user -> words.stream().allMatch(word -> plain(user.getFullName() + " " + user.getUsername()
                        + " " + user.getEmail()).contains(word)))
                .map(this::row)
                .filter(row -> status == null || status.isBlank() || "all".equals(status)
                        || row.status().equalsIgnoreCase(status))
                .sorted(order)
                .limit(300)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserDetail user(User admin, Long id) {
        requireAdmin(admin);
        User user = find(id);
        List<ProjectRow> projects = new ArrayList<>();
        for (Project project : projectService.findProjectsForUser(user)) {
            projects.add(new ProjectRow(project.getId(), project.getName(), project.getType(),
                    ProjectAccessService.isOwner(project, user) ? "OWNER" : "MEMBER", project.getStatus(),
                    PostService.ndaBlocks(project), PostService.isProjectPublicContent(project),
                    memberRepository.findByProjectOrderByJoinedAtAsc(project).size() + 1,
                    fileRepository.totalBytesOfProject(project)));
        }
        List<Post> publicPosts = postRepository.findByAuthorOrderByIdDesc(user).stream()
                .filter(PostService::isPublicContent)
                .limit(12)
                .toList();
        LocalDateTime now = LocalDateTime.now();
        List<com.example.backend.dto.AdminDtos.EventRow> events = eventRepository == null ? List.of()
                : eventRepository.findByUserIdOrderByIdDesc(user.getId(), PageRequest.of(0, 200)).stream()
                        .map(e -> new com.example.backend.dto.AdminDtos.EventRow(e.getId(), e.getType().name(), e.getIp(),
                                e.getUserAgent(), e.getDeviceId(), e.getEmail(), e.getDetail(), e.getCreatedAt()))
                        .toList();
        List<UserRow> related = evidence == null ? List.of()
                : evidence.related(user).stream().map(userRepository::findById).flatMap(java.util.Optional::stream)
                        .map(this::row).toList();
        List<com.example.backend.dto.AdminDtos.EvidenceRow> evidences = evidenceRepository == null ? List.of()
                : evidenceRepository.findByUserIdOrderByIdAsc(user.getId()).stream()
                        .map(e -> new com.example.backend.dto.AdminDtos.EvidenceRow(e.getId(), e.getAction(), e.getReason(),
                                e.getAdminEmail(), e.getSha256(), e.getCreatedAt()))
                        .toList();
        List<com.example.backend.dto.AdminDtos.BanRow> bans = banRepository == null ? List.of()
                : banRepository.findBySourceUserIdOrderByIdAsc(user.getId()).stream()
                        .map(b -> new com.example.backend.dto.AdminDtos.BanRow(b.getId(), b.getKind().name(), b.getValue(),
                                b.getCreatedAt(), b.getExpiresAt(), b.isActive(now)))
                        .toList();
        return new UserDetail(row(user), user.getBio(), ProfileResponse.split(user.getSpecialties(), ","),
                user.getSuspensionReason(), user.getBannedAt(), user.getBanReason(), user.getStorageQuotaMb(),
                user.getAdminNote(), user.isTrusted(), postRepository.countByAuthorAndPendingReviewTrue(user),
                projects, postService.toResponses(publicPosts, admin),
                callRepository.findByAuthorOrderByIdDesc(user).size(),
                actionRepository.findByTargetTypeAndTargetIdOrderByIdDesc("USER", user.getId()).stream()
                        .map(AdminService::row).toList(), events, related, evidences, bans);
    }

    @Transactional
    public UserDetail suspend(User admin, Long id, Integer days, String reason) {
        requireAdmin(admin);
        User user = target(admin, id);
        if (user.isBanned()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Essa conta já foi banida.");
        }
        if (days != null && (days < 1 || days > MAX_SUSPENSION_DAYS)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Escolha de 1 a " + MAX_SUSPENSION_DAYS + " dias, ou suspensão sem prazo.");
        }
        String why = reason(reason);
        if (evidence != null) {
            evidence.freeze(user, "SUSPEND", why, admin.getEmail(), null);
        }
        user.setSuspended(true);
        user.setSuspendedUntil(days == null ? null : LocalDateTime.now().plusDays(days));
        user.setSuspensionReason(why);
        userRepository.save(user);
        record(admin, "SUSPEND", user, why, days == null ? "sem prazo" : days + (days == 1 ? " dia" : " dias"));
        return user(admin, id);
    }

    @Transactional
    public UserDetail reactivate(User admin, Long id, String reason) {
        requireAdmin(admin);
        User user = find(id);
        if (user.isBanned()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Banimento não tem volta.");
        }
        if (!user.isSuspended()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Essa conta não está suspensa.");
        }
        user.setSuspended(false);
        user.setSuspendedUntil(null);
        user.setSuspensionReason(null);
        userRepository.save(user);
        record(admin, "REACTIVATE", user, reason == null || reason.isBlank() ? null : reason.trim(), null);
        return user(admin, id);
    }

    /** Cota só desta pessoa (MB; -1 volta para a padrão) e anotação interna. */
    @Transactional
    public UserDetail update(User admin, Long id, Integer quotaMb, String note) {
        requireAdmin(admin);
        User user = find(id);
        if (quotaMb != null) {
            if (quotaMb == -1) {
                user.setStorageQuotaMb(null);
                record(admin, "QUOTA", user, null, "volta para a cota padrão");
            } else if (quotaMb < 0 || quotaMb > MAX_QUOTA_MB) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A cota vai de 0 a " + MAX_QUOTA_MB + " MB.");
            } else {
                user.setStorageQuotaMb(quotaMb);
                record(admin, "QUOTA", user, null, quotaMb + " MB");
            }
        }
        if (note != null) {
            String text = note.trim();
            if (text.length() > 2000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A anotação vai até 2000 caracteres.");
            }
            user.setAdminNote(text.isEmpty() ? null : text);
            record(admin, "NOTE", user, null, null);
        }
        userRepository.save(user);
        return user(admin, id);
    }

    // ---- Registro ----

    @Transactional(readOnly = true)
    public List<ActionRow> log(User admin, int limit) {
        requireAdmin(admin);
        return actionRepository.findAllByOrderByIdDesc(PageRequest.of(0, Math.max(1, Math.min(limit, 500))))
                .stream().map(AdminService::row).toList();
    }

    /** Suspensões com prazo voltam sozinhas (também voltam no login, se a pessoa tentar antes). */
    @Scheduled(fixedDelay = 10 * 60 * 1000L, initialDelay = 60 * 1000L)
    @Transactional
    public void liftExpiredSuspensions() {
        for (User user : userRepository.findBySuspendedTrueAndSuspendedUntilBefore(LocalDateTime.now())) {
            user.setSuspended(false);
            user.setSuspendedUntil(null);
            user.setSuspensionReason(null);
            userRepository.save(user);
            AdminAction action = action("sistema", "REACTIVATE", user, null, "prazo da suspensão acabou");
            actionRepository.save(action);
        }
    }

    // ---- Regras internas ----

    private User find(Long id) {
        return userRepository.findById(id).filter(user -> !user.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta não encontrada."));
    }

    /** Alvo de suspensão ou banimento: nunca você mesmo nem outro administrador. */
    private User target(User admin, Long id) {
        User user = find(id);
        if (ProjectAccessService.sameUser(user, admin)) {
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

    private void record(User admin, String type, User target, String reason, String detail) {
        actionRepository.save(action(admin.getEmail(), type, target, reason, detail));
    }

    private static AdminAction action(String adminEmail, String type, User target, String reason, String detail) {
        AdminAction action = new AdminAction();
        action.setAdminEmail(adminEmail);
        action.setAction(type);
        action.setTargetType("USER");
        action.setTargetId(target.getId());
        action.setTargetLabel("@" + target.getUsername() + " · " + target.getFullName());
        action.setReason(reason);
        action.setDetail(detail);
        return action;
    }

    private UserRow row(User user) {
        String status = user.isBanned() ? "BANNED" : user.isBlocked() ? "SUSPENDED" : "ACTIVE";
        return new UserRow(user.getId(), user.getFullName(), user.getUsername(), user.getEmail(), user.getRole().name(),
                user.avatarUrl(), user.getCreatedAt(), user.getLastLoginAt(), status,
                "SUSPENDED".equals(status) ? user.getSuspendedUntil() : null, fileService.usedBytes(user),
                fileService.quotaBytes(user), postRepository.countByAuthor(user), adminAccess.isAdmin(user));
    }

    private static ActionRow row(AdminAction action) {
        return new ActionRow(action.getId(), action.getAdminEmail(), action.getAction(), action.getTargetType(),
                action.getTargetId(), action.getTargetLabel(), action.getReason(), action.getDetail(),
                action.getCreatedAt());
    }

    private Long databaseBytes() {
        if (entityManager == null) {
            return null;
        }
        try {
            Object value = entityManager.createNativeQuery("select pg_database_size(current_database())").getSingleResult();
            return value instanceof Number number ? number.longValue() : null;
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String plain(String text) {
        return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }

    private static List<String> words(String query) {
        return query == null || query.isBlank() ? List.of()
                : java.util.Arrays.stream(plain(query).split("\\s+")).filter(word -> !word.isEmpty()).toList();
    }
}
