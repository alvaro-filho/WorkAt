package com.example.backend.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Registro de acesso e de ações sensíveis (cadastro, login, publicação, bloqueios), com IP, navegador e aparelho.
 * Guarda o id e o @ da conta em texto (sem chave estrangeira) para continuar valendo como prova mesmo se a conta
 * mudar ou for excluída. O Marco Civil (art. 15) pede registros de acesso por no mínimo 6 meses.
 */
@Entity
@Table(name = "security_event", indexes = {
        @Index(name = "idx_security_event_user", columnList = "user_id, created_at"),
        @Index(name = "idx_security_event_ip", columnList = "ip, created_at"),
        @Index(name = "idx_security_event_device", columnList = "device_id")})
public class SecurityEvent {

    /** SIGNUP, LOGIN_OK, LOGIN_FAIL, POST, UPLOAD, COMMENT e os bloqueios BLOCKED_*. */
    public enum Type {
        SIGNUP, LOGIN_OK, LOGIN_FAIL, POST, UPLOAD, COMMENT,
        BLOCKED_VPN, BLOCKED_BAN, BLOCKED_LIMIT, BLOCKED_EMAIL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(length = 60)
    private String username;

    /** E-mail digitado (cadastro e login), útil quando a tentativa nem chega a ter conta. */
    @Column(length = 160)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Type type;

    @Column(length = 64)
    private String ip;

    @Column(name = "forwarded_chain", length = 300)
    private String forwardedChain;

    @Column(name = "user_agent", length = 300)
    private String userAgent;

    @Column(name = "device_id", length = 64)
    private String deviceId;

    @Column(length = 300)
    private String detail;

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
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }
    public String getIp() { return ip; }
    public void setIp(String ip) { this.ip = ip; }
    public String getForwardedChain() { return forwardedChain; }
    public void setForwardedChain(String forwardedChain) { this.forwardedChain = forwardedChain; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
