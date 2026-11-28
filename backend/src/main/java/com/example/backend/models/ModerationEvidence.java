package com.example.backend.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Prova congelada no momento de uma ação de moderação (suspender, banir, remover publicação): um JSON com os
 * dados da conta, os registros de acesso (IP, navegador, aparelho), o conteúdo e o hash de cada imagem, mais o
 * SHA-256 do próprio JSON para provar que não foi alterado depois. Sem chave estrangeira: vale mesmo se a conta
 * ou o conteúdo sumirem.
 */
@Entity
@Table(name = "moderation_evidence", indexes = @Index(name = "idx_moderation_evidence_user", columnList = "user_id"))
public class ModerationEvidence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(length = 60)
    private String username;

    /** SUSPEND, BAN, REMOVE_POST. */
    @Column(nullable = false, length = 20)
    private String action;

    @Column(name = "admin_email", length = 160)
    private String adminEmail;

    @Column(length = 500)
    private String reason;

    @Column(name = "snapshot", nullable = false, columnDefinition = "TEXT")
    private String snapshot;

    @Column(name = "sha256", nullable = false, length = 64)
    private String sha256;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getAdminEmail() { return adminEmail; }
    public void setAdminEmail(String adminEmail) { this.adminEmail = adminEmail; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getSnapshot() { return snapshot; }
    public void setSnapshot(String snapshot) { this.snapshot = snapshot; }
    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
