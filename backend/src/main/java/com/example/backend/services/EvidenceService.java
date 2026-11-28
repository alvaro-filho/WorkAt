package com.example.backend.services;

import com.example.backend.models.JobCall;
import com.example.backend.models.ModerationEvidence;
import com.example.backend.models.Post;
import com.example.backend.models.PostComment;
import com.example.backend.models.PostImage;
import com.example.backend.models.SecurityBan;
import com.example.backend.models.SecurityEvent;
import com.example.backend.models.User;
import com.example.backend.repositories.JobCallRepository;
import com.example.backend.repositories.ModerationEvidenceRepository;
import com.example.backend.repositories.PostCommentRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.SecurityBanRepository;
import com.example.backend.repositories.SecurityEventRepository;
import com.example.backend.repositories.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Provas de moderação. Monta um retrato da conta (dados, registros de acesso com IP, navegador e aparelho,
 * publicações com o hash SHA-256 de cada imagem, comentários, Chamadas, contas ligadas e bloqueios) e o congela
 * com o SHA-256 do próprio JSON. As imagens não são copiadas: o hash prova qual era o arquivo, e o dossiê pode
 * incluir a imagem na hora de baixar, se ela ainda existir.
 */
@Service
public class EvidenceService {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final PostCommentRepository commentRepository;
    private final JobCallRepository callRepository;
    private final SecurityEventRepository eventRepository;
    private final SecurityBanRepository banRepository;
    private final ModerationEvidenceRepository evidenceRepository;
    private final FileStorage storage;
    private final ObjectMapper json = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .enable(SerializationFeature.INDENT_OUTPUT);

    public EvidenceService(UserRepository userRepository, PostRepository postRepository,
                           PostCommentRepository commentRepository, JobCallRepository callRepository,
                           SecurityEventRepository eventRepository, SecurityBanRepository banRepository,
                           ModerationEvidenceRepository evidenceRepository, FileStorage storage) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.callRepository = callRepository;
        this.eventRepository = eventRepository;
        this.banRepository = banRepository;
        this.evidenceRepository = evidenceRepository;
        this.storage = storage;
    }

    /** Congela a prova de uma ação. post != null: a prova é da remoção daquela publicação (com a conta junto). */
    @Transactional
    public ModerationEvidence freeze(User user, String action, String reason, String adminEmail, Post post) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("acao", action);
        snapshot.put("geradoEm", LocalDateTime.now());
        snapshot.put("administrador", adminEmail);
        snapshot.put("motivo", reason);
        if (post != null) {
            snapshot.put("publicacaoRemovida", post(post));
        }
        snapshot.putAll(account(user));
        String text = write(snapshot);
        ModerationEvidence evidence = new ModerationEvidence();
        evidence.setUserId(user.getId());
        evidence.setUsername(user.getUsername());
        evidence.setAction(action);
        evidence.setAdminEmail(adminEmail);
        evidence.setReason(reason);
        evidence.setSnapshot(text);
        evidence.setSha256(sha256(text.getBytes(StandardCharsets.UTF_8)));
        return evidenceRepository.save(evidence);
    }

    /** Retrato completo da conta, para o dossiê e para cada prova congelada. */
    @Transactional(readOnly = true)
    public Map<String, Object> account(User user) {
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> conta = new LinkedHashMap<>();
        conta.put("id", user.getId());
        conta.put("usuario", user.getUsername());
        conta.put("nome", user.getFullName());
        conta.put("email", user.getEmail());
        conta.put("tipo", user.getRole() == null ? null : user.getRole().name());
        conta.put("cadastradaEm", user.getCreatedAt());
        conta.put("ultimoLogin", user.getLastLoginAt());
        conta.put("bio", user.getBio());
        conta.put("especialidades", user.getSpecialties());
        conta.put("links", user.getLinks());
        conta.put("confiavel", user.isTrusted());
        conta.put("suspensa", user.isSuspended());
        conta.put("suspensaAte", user.getSuspendedUntil());
        conta.put("motivoSuspensao", user.getSuspensionReason());
        conta.put("banida", user.isBanned());
        conta.put("banidaEm", user.getBannedAt());
        conta.put("motivoBanimento", user.getBanReason());
        out.put("conta", conta);

        out.put("registrosDeAcesso", eventRepository.findByUserIdOrderByIdAsc(user.getId()).stream()
                .map(EvidenceService::event).toList());
        out.put("publicacoes", postRepository.findByAuthorOrderByIdDesc(user).stream().map(this::post).toList());
        out.put("comentarios", commentRepository.findByAuthor(user).stream().map(EvidenceService::comment).toList());
        out.put("chamadas", callRepository.findByAuthorOrderByIdDesc(user).stream().map(EvidenceService::call).toList());
        out.put("contasLigadas", related(user).stream().map(id -> userRepository.findById(id)
                .map(other -> Map.<String, Object>of("id", other.getId(), "usuario", other.getUsername(),
                        "email", other.getEmail() == null ? "" : other.getEmail()))
                .orElse(Map.of("id", id))).toList());
        out.put("bloqueios", banRepository.findBySourceUserIdOrderByIdAsc(user.getId()).stream()
                .map(EvidenceService::ban).toList());
        return out;
    }

    /** Contas que usaram os mesmos IPs (últimos 90 dias) ou os mesmos aparelhos. */
    @Transactional(readOnly = true)
    public List<Long> related(User user) {
        List<String> ips = eventRepository.ipsOf(user.getId(), LocalDateTime.now().minusDays(90));
        List<String> devices = eventRepository.devicesOf(user.getId());
        if (ips.isEmpty() && devices.isEmpty()) {
            return List.of();
        }
        // "in ()" vazio não vale em JPQL: um valor que nunca existe faz o papel de lista vazia.
        return eventRepository.relatedUserIds(user.getId(), ips.isEmpty() ? List.of("-") : ips,
                devices.isEmpty() ? List.of("-") : devices);
    }

    /** Nome guardado de cada imagem da publicação (arquivo próprio ou o arquivo da tarefa). */
    public static String storedNameOf(PostImage image) {
        return image.getStoredName() != null ? image.getStoredName()
                : image.getTaskFile() != null ? image.getTaskFile().getStoredName() : null;
    }

    public Optional<Resource> load(String storedName) {
        return storedName == null ? Optional.empty() : storage.load(storedName);
    }

    public String write(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Não deu para montar o JSON da prova.", e);
        }
    }

    public static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private Map<String, Object> post(Post post) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", post.getId());
        out.put("tipo", post.getKind() == null ? null : post.getKind().name());
        out.put("titulo", post.getTitle());
        out.put("subtitulo", post.getSubtitle());
        out.put("publicadaEm", post.getCreatedAt());
        out.put("aguardandoAprovacao", post.isPendingReview());
        out.put("projeto", post.getProject() == null ? null : post.getProject().getName());
        List<Map<String, Object>> images = new ArrayList<>();
        for (PostImage image : post.getImages()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            String name = storedNameOf(image);
            entry.put("id", image.getId());
            entry.put("arquivo", name);
            entry.put("tipo", image.getContentType());
            entry.put("bytes", image.getSizeBytes());
            entry.put("sha256", hashOf(name));
            images.add(entry);
        }
        out.put("imagens", images);
        return out;
    }

    private String hashOf(String storedName) {
        Optional<Resource> resource = load(storedName);
        if (resource.isEmpty()) {
            return null;
        }
        try (InputStream input = resource.get().getInputStream()) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) > 0) {
                digest.update(buffer, 0, read);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception e) {
            return null;
        }
    }

    private static Map<String, Object> event(SecurityEvent event) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("quando", event.getCreatedAt());
        out.put("tipo", event.getType().name());
        out.put("ip", event.getIp());
        out.put("cadeiaDeProxies", event.getForwardedChain());
        out.put("navegador", event.getUserAgent());
        out.put("aparelho", event.getDeviceId());
        out.put("email", event.getEmail());
        out.put("detalhe", event.getDetail());
        return out;
    }

    private static Map<String, Object> comment(PostComment comment) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", comment.getId());
        out.put("texto", comment.getBody());
        out.put("removido", comment.isRemoved());
        out.put("em", comment.getCreatedAt());
        out.put("publicacao", comment.getPost() == null ? null : comment.getPost().getId());
        out.put("projeto", comment.getProject() == null ? null : comment.getProject().getId());
        return out;
    }

    private static Map<String, Object> call(JobCall call) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", call.getId());
        out.put("titulo", call.getTitle());
        out.put("descricao", call.getDescription());
        out.put("criadaEm", call.getCreatedAt());
        return out;
    }

    private static Map<String, Object> ban(SecurityBan ban) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tipo", ban.getKind().name());
        out.put("valor", ban.getValue());
        out.put("criadoEm", ban.getCreatedAt());
        out.put("expiraEm", ban.getExpiresAt());
        return out;
    }

    /** Valores distintos, na ordem em que apareceram. */
    static Set<String> distinct(List<String> values) {
        return new LinkedHashSet<>(values);
    }
}
