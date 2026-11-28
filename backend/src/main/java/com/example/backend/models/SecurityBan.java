package com.example.backend.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Bloqueio de IP, aparelho ou e-mail, criado ao banir uma conta. expiresAt null = para sempre
 * (aparelho e e-mail); IPs valem 90 dias, porque no Brasil o mesmo IP de celular é dividido por muita gente.
 */
@Entity
@Table(name = "security_ban", indexes = @Index(name = "idx_security_ban_value", columnList = "kind, value"))
public class SecurityBan {

    public enum Kind { IP, DEVICE, EMAIL }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Kind kind;

    @Column(nullable = false, length = 160)
    private String value;

    /** Conta que originou o bloqueio (texto, sem chave estrangeira). */
    @Column(name = "source_user_id")
    private Long sourceUserId;

    @Column(name = "source_username", length = 60)
    private String sourceUsername;

    @Column(length = 500)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public boolean isActive(LocalDateTime now) {
        return expiresAt == null || expiresAt.isAfter(now);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Kind getKind() { return kind; }
    public void setKind(Kind kind) { this.kind = kind; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public Long getSourceUserId() { return sourceUserId; }
    public void setSourceUserId(Long sourceUserId) { this.sourceUserId = sourceUserId; }
    public String getSourceUsername() { return sourceUsername; }
    public void setSourceUsername(String sourceUsername) { this.sourceUsername = sourceUsername; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}
