package com.example.backend.dto;

import com.example.backend.models.ProjectStatus;
import com.example.backend.models.ProjectType;

import java.time.LocalDateTime;
import java.util.List;

/** Respostas e pedidos do painel de administração. */
public final class AdminDtos {

    private AdminDtos() {
    }

    /** Visão geral: números do site e os medidores contra os limites do plano grátis. */
    public record Overview(UserCounts users, long posts, long pendingPosts, long projects, long openCalls, Meter storage,
                           Meter database, int defaultQuotaMb, List<UserRow> recentSignups,
                           List<ActionRow> recentActions) {
    }

    public record UserCounts(long total, long artists, long companies, long suspended, long banned,
                             long newLast30Days) {
    }

    /** usedBytes contra limitBytes; usedBytes null quando não deu para medir. */
    public record Meter(Long usedBytes, long limitBytes) {
    }

    /** status: ACTIVE, SUSPENDED ou BANNED. */
    public record UserRow(Long id, String fullName, String username, String email, String role,
                          String avatarUrl, LocalDateTime createdAt, LocalDateTime lastLoginAt, String status,
                          LocalDateTime suspendedUntil, long usedBytes, long quotaBytes, long postCount,
                          boolean admin) {
    }

    /**
     * Ficha da conta. Projetos privados e sob NDA aparecem só com os dados de fora (nome, tipo, membros,
     * tamanho); publicações, só as de conteúdo público.
     */
    public record UserDetail(UserRow user, String bio, List<String> specialties, String suspensionReason,
                             LocalDateTime bannedAt, String banReason, Integer storageQuotaMb, String adminNote,
                             boolean trusted, long pendingPosts,
                             List<ProjectRow> projects, List<PostResponse> publicPosts, long callCount,
                             List<ActionRow> actions, List<EventRow> events, List<UserRow> related,
                             List<EvidenceRow> evidences, List<BanRow> bans) {
    }

    /** Registro de acesso: cadastro, login, publicação e bloqueios, com IP, navegador e aparelho. */
    public record EventRow(Long id, String type, String ip, String userAgent, String deviceId, String email,
                           String detail, LocalDateTime createdAt) {
    }

    /** Prova congelada (o conteúdo vem no dossiê). */
    public record EvidenceRow(Long id, String action, String reason, String adminEmail, String sha256,
                              LocalDateTime createdAt) {
    }

    public record BanRow(Long id, String kind, String value, LocalDateTime createdAt, LocalDateTime expiresAt,
                         boolean active) {
    }

    /** role: OWNER (dirige) ou MEMBER. publicView: aberto ao público. */
    public record ProjectRow(Long id, String name, ProjectType type, String role, ProjectStatus status,
                             boolean nda, boolean publicView, int members, long bytes) {
    }

    public record ActionRow(Long id, String adminEmail, String action, String targetType, Long targetId,
                            String targetLabel, String reason, String detail, LocalDateTime createdAt) {
    }

    /** days null = sem prazo. */
    public record SuspendRequest(Integer days, String reason) {
    }

    public record ReasonRequest(String reason) {
    }

    public record BanRequest(String reason, String password) {
    }

    /** quotaMb: -1 volta para a cota padrão; note: anotação interna. Campos ausentes não mudam. */
    public record UpdateRequest(Integer quotaMb, String note) {
    }
}
