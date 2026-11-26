package com.example.backend.services;

import com.example.backend.models.InvitationStatus;
import com.example.backend.models.PasswordResetToken;
import com.example.backend.models.Post;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.PasswordResetTokenRepository;
import com.example.backend.repositories.ProjectInvitationRepository;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.TaskCommentRepository;
import com.example.backend.repositories.TaskFileRepository;
import com.example.backend.repositories.TaskRepository;
import com.example.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** Conta da pessoa: perfil público, foto, senha, exportar dados e excluir conta. */
@Service
public class AccountService {

    public static final String PASSWORD_RULE = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,}$";
    public static final String PASSWORD_MESSAGE =
            "A senha deve ter no mínimo 8 caracteres, incluindo uma letra maiúscula, uma minúscula e um número.";
    private static final Map<String, String> AVATAR_TYPES = Map.of(
            "png", "image/png", "jpg", "image/jpeg", "jpeg", "image/jpeg", "webp", "image/webp");
    private static final long AVATAR_MAX_BYTES = 5L * 1024 * 1024;
    private static final long BANNER_MAX_BYTES = 8L * 1024 * 1024;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final FileStorage storage;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordResetMailer mailer;
    private final ProjectService projectService;
    private final ProjectMembershipService membershipService;
    private final ProjectMemberRepository memberRepository;
    private final ProjectInvitationRepository invitationRepository;
    private final PostService postService;
    private final NotificationRepository notificationRepository;
    private final TaskRepository taskRepository;
    private final TaskFileRepository fileRepository;
    private final TaskCommentRepository commentRepository;
    private final TaskFileService taskFileService;
    private final String publicUrl;

    public AccountService(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder, FileStorage storage,
                          PasswordResetTokenRepository tokenRepository, PasswordResetMailer mailer,
                          ProjectService projectService, ProjectMembershipService membershipService,
                          ProjectMemberRepository memberRepository, ProjectInvitationRepository invitationRepository,
                          PostService postService, NotificationRepository notificationRepository,
                          TaskRepository taskRepository, TaskFileRepository fileRepository,
                          TaskCommentRepository commentRepository, TaskFileService taskFileService,
                          @Value("${app.public-url:http://localhost:8081}") String publicUrl) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.storage = storage;
        this.tokenRepository = tokenRepository;
        this.mailer = mailer;
        this.projectService = projectService;
        this.membershipService = membershipService;
        this.memberRepository = memberRepository;
        this.invitationRepository = invitationRepository;
        this.postService = postService;
        this.notificationRepository = notificationRepository;
        this.taskRepository = taskRepository;
        this.fileRepository = fileRepository;
        this.commentRepository = commentRepository;
        this.taskFileService = taskFileService;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
    }

    // ---- Perfil ----

    public long usedBytes(User user) {
        return taskFileService.usedBytes(user);
    }

    public long quotaBytes() {
        return taskFileService.quotaBytes();
    }

    @Transactional
    public User updateProfile(User user, String fullName, String bio, List<String> specialties, List<String> links) {
        if (fullName != null) {
            String name = fullName.trim();
            if (name.length() < 2 || name.length() > 100) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O nome deve ter entre 2 e 100 caracteres.");
            }
            user.setFullName(name);
        }
        if (bio != null) {
            String text = bio.trim();
            if (text.length() > 500) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A bio deve ter no máximo 500 caracteres.");
            }
            user.setBio(text.isEmpty() ? null : text);
        }
        if (specialties != null) {
            List<String> clean = specialties.stream().map(s -> s == null ? "" : s.trim().replace(",", " "))
                    .filter(s -> !s.isEmpty()).distinct().toList();
            if (clean.size() > 8 || clean.stream().anyMatch(s -> s.length() > 40)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Use até 8 especialidades, com até 40 caracteres cada.");
            }
            user.setSpecialties(clean.isEmpty() ? null : String.join(", ", clean));
        }
        if (links != null) {
            List<String> clean = new ArrayList<>();
            for (String link : links) {
                String url = link == null ? "" : link.trim();
                if (url.isEmpty()) {
                    continue;
                }
                if (!isHttpUrl(url) || url.chars().anyMatch(Character::isWhitespace) || url.length() > 200) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Link inválido: " + url + ". Use um endereço começando com https://");
                }
                clean.add(url);
            }
            if (clean.size() > 5) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use até 5 links.");
            }
            user.setLinks(clean.isEmpty() ? null : String.join("\n", clean));
        }
        return userRepository.save(user);
    }

    private record StoredImage(String storedName, String contentType) {
    }

    /** Grava uma imagem de perfil (PNG, JPG ou WEBP) e devolve o nome salvo. */
    private StoredImage storeProfileImage(MultipartFile file, long maxBytes, String what) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escolha uma imagem.");
        }
        if (file.getSize() > maxBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "A " + what + " deve ter no máximo " + (maxBytes / (1024 * 1024)) + " MB.");
        }
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String extension = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        String contentType = AVATAR_TYPES.get(extension);
        if (contentType == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "A " + what + " precisa ser PNG, JPG ou WEBP.");
        }
        try {
            return new StoredImage(storage.save(file.getInputStream(), extension), contentType);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível ler a imagem.");
        }
    }

    @Transactional
    public User uploadAvatar(User user, MultipartFile file) {
        StoredImage image = storeProfileImage(file, AVATAR_MAX_BYTES, "foto");
        String old = user.getAvatarStoredName();
        user.setAvatarStoredName(image.storedName());
        user.setAvatarContentType(image.contentType());
        user.setAvatarUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        storage.delete(old);
        return saved;
    }

    @Transactional
    public User uploadBanner(User user, MultipartFile file) {
        StoredImage image = storeProfileImage(file, BANNER_MAX_BYTES, "capa");
        String old = user.getBannerStoredName();
        user.setBannerStoredName(image.storedName());
        user.setBannerContentType(image.contentType());
        user.setBannerUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        storage.delete(old);
        return saved;
    }

    @Transactional
    public User removeBanner(User user) {
        storage.delete(user.getBannerStoredName());
        user.setBannerStoredName(null);
        user.setBannerContentType(null);
        user.setBannerUpdatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public Avatar banner(String username) {
        User user = userRepository.findByUsername(username).filter(u -> !u.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Capa não encontrada."));
        Resource content = storage.load(user.getBannerStoredName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Capa não encontrada."));
        return new Avatar(content, user.getBannerContentType());
    }

    @Transactional
    public User removeAvatar(User user) {
        storage.delete(user.getAvatarStoredName());
        user.setAvatarStoredName(null);
        user.setAvatarContentType(null);
        user.setAvatarUpdatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    public record Avatar(Resource content, String contentType) {
    }

    @Transactional(readOnly = true)
    public Avatar avatar(String username) {
        User user = userRepository.findByUsername(username).filter(u -> !u.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Foto não encontrada."));
        Resource content = storage.load(user.getAvatarStoredName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Foto não encontrada."));
        return new Avatar(content, user.getAvatarContentType());
    }

    // ---- Senha ----

    @Transactional
    public void changePassword(User user, String current, String next) {
        if (current == null || !passwordEncoder.matches(current, user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A senha atual está incorreta.");
        }
        user.setPasswordHash(passwordEncoder.encode(validPassword(next)));
        userRepository.save(user);
    }

    /** Sempre responde igual, exista a conta ou não (não revela quem tem cadastro). */
    @Transactional
    public void requestPasswordReset(String email) {
        Optional<User> found = userRepository.findByEmailAnyCase(email).filter(u -> !u.isDeleted());
        if (found.isEmpty()) {
            return;
        }
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        PasswordResetToken row = new PasswordResetToken();
        row.setUser(found.get());
        row.setTokenHash(sha256(token));
        row.setExpiresAt(LocalDateTime.now().plusHours(1));
        tokenRepository.save(row);
        mailer.send(found.get(), publicUrl + "/redefinir-senha?token=" + token);
    }

    @Transactional
    public void resetPassword(String token, String next) {
        String password = validPassword(next);
        PasswordResetToken row = token == null ? null : tokenRepository.findByTokenHash(sha256(token.trim())).orElse(null);
        if (row == null || row.getUsedAt() != null || row.getExpiresAt().isBefore(LocalDateTime.now())
                || row.getUser().isDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Link inválido ou vencido. Peça um novo em \"Esqueci minha senha\".");
        }
        User user = row.getUser();
        user.setPasswordHash(passwordEncoder.encode(password));
        userRepository.save(user);
        row.setUsedAt(LocalDateTime.now());
        tokenRepository.save(row);
    }

    // ---- Exportar e excluir ----

    /** Os dados da pessoa, em JSON (LGPD: direito de acesso e portabilidade). */
    @Transactional(readOnly = true)
    public Map<String, Object> export(User user) {
        Map<String, Object> data = new LinkedHashMap<>();
        Map<String, Object> account = new LinkedHashMap<>();
        account.put("nome", user.getFullName());
        account.put("usuario", user.getUsername());
        account.put("email", user.getEmail());
        account.put("perfil", user.getRole().name());
        account.put("criadaEm", user.getCreatedAt());
        account.put("bio", user.getBio());
        account.put("especialidades", user.getSpecialties());
        account.put("links", user.getLinks());
        data.put("conta", account);
        data.put("projetos", projectService.findProjectsForUser(user).stream().map(p -> Map.of(
                "id", p.getId(), "nome", p.getName(), "tipo", p.getType().name(),
                "papel", ProjectAccessService.isOwner(p, user) ? "DONO" : "MEMBRO")).toList());
        data.put("tarefasAtribuidas", taskRepository.findByAssignee(user).stream().map(t -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("titulo", t.getTitle());
            row.put("projeto", t.getProject().getName());
            row.put("status", t.getStatus().name());
            row.put("prazo", t.getDeadline());
            return row;
        }).toList());
        data.put("arquivosEnviados", fileRepository.findByUploadedBy(user).stream().map(f -> Map.of(
                "nome", f.getOriginalName(), "versao", f.getVersion(), "bytes", f.getSizeBytes(),
                "tarefa", f.getTask().getTitle(), "enviadoEm", f.getCreatedAt())).toList());
        data.put("publicacoes", postService.visibleByAuthor(user, user).stream().map(p -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("titulo", p.getTitle());
            row.put("tipo", p.getKind().name());
            row.put("criadaEm", p.getCreatedAt());
            return row;
        }).toList());
        data.put("comentarios", commentRepository.findByAuthorOrderByIdAsc(user).stream().map(c -> Map.of(
                "tarefa", c.getTask().getTitle(), "texto", c.getBody(), "criadoEm", c.getCreatedAt())).toList());
        data.put("exportadoEm", LocalDateTime.now());
        return data;
    }

    /**
     * Exclui a conta: apaga os projetos dela que não têm membros, sai dos outros, apaga publicações e avisos
     * e anonimiza o cadastro (comentários e entregas em projetos de outras pessoas ficam como "Conta excluída").
     * Projetos dela com membros precisam ser passados para alguém antes.
     */
    @Transactional
    public void deleteAccount(User user, String password) {
        if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Senha incorreta.");
        }
        List<Project> projects = projectService.findProjectsForUser(user);
        List<String> blocking = projects.stream()
                .filter(p -> ProjectAccessService.isOwner(p, user))
                .filter(p -> !memberRepository.findByProjectOrderByJoinedAtAsc(p).isEmpty())
                .map(Project::getName)
                .toList();
        if (!blocking.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Antes de excluir a conta, passe para um membro (aba Membros) ou apague estes projetos: "
                            + String.join(", ", blocking) + ".");
        }
        for (Project project : projects) {
            if (ProjectAccessService.isOwner(project, user)) {
                if (project.getStatus() == ProjectStatus.ACTIVE) {
                    projectService.updateStatus(project.getId(), user, "CLOSED");
                }
                projectService.deleteProject(project.getId(), user);
            } else {
                membershipService.leave(project.getId(), user);
            }
        }
        invitationRepository.findByInvitedUserAndStatusOrderByCreatedAtDesc(user, InvitationStatus.PENDING)
                .forEach(invitation -> {
                    invitation.setStatus(InvitationStatus.DECLINED);
                    invitation.setRespondedAt(LocalDateTime.now());
                    invitationRepository.save(invitation);
                });
        for (Post post : postService.visibleByAuthor(user, user)) {
            postService.delete(post.getId(), user);
        }
        notificationRepository.deleteAllOf(user);
        storage.delete(user.getAvatarStoredName());
        storage.delete(user.getBannerStoredName());

        String suffix = user.getId() + "-" + Long.toHexString(RANDOM.nextLong());
        user.setUsername("excluido-" + suffix);
        user.setFullName("Conta excluída");
        user.setEmail("excluido-" + suffix + "@workat.invalid");
        user.setPasswordHash(passwordEncoder.encode(Long.toHexString(RANDOM.nextLong()) + "Aa1!"));
        user.setBio(null);
        user.setSpecialties(null);
        user.setLinks(null);
        user.setAvatarStoredName(null);
        user.setAvatarContentType(null);
        user.setBannerStoredName(null);
        user.setBannerContentType(null);
        user.setDeleted(true);
        userRepository.save(user);
    }

    private static String validPassword(String password) {
        if (password == null || !password.matches(PASSWORD_RULE)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, PASSWORD_MESSAGE);
        }
        return password;
    }

    static String sha256(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    /** Endereço http(s) com host. */
    static boolean isHttpUrl(String value) {
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            return ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) && uri.getHost() != null;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}
