package com.example.backend.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Registro do painel de administração: quem fez, o quê, em quem, por quê e quando.
 * Guarda o e-mail e o nome do alvo em texto para continuar legível mesmo se a conta mudar ou sumir.
 * O painel não tem como apagar estas linhas.
 */
@Entity
@Table(name = "admin_action", indexes = @Index(name = "idx_admin_action_created", columnList = "created_at"))
public class AdminAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_email", nullable = false, length = 160)
    private String adminEmail;

    /** SUSPEND, REACTIVATE, BAN, QUOTA, NOTE... */
    @Column(nullable = false, length = 30)
    private String action;

    /** USER, POST, COMMENT, CALL, PROJECT. */
    @Column(name = "target_type", nullable = false, length = 20)
    private String targetType;

    @Column(name = "target_id")
    private Long targetId;

    /** Como o alvo se chamava na hora ("@ana · Ana Lima", "Publicação 'Estudo'"). */
    @Column(name = "target_label", length = 200)
    private String targetLabel;

    @Column(length = 500)
    private String reason;

    /** Detalhe da ação ("7 dias", "cota 50 MB"). */
    @Column(length = 200)
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
    public String getAdminEmail() { return adminEmail; }
    public void setAdminEmail(String adminEmail) { this.adminEmail = adminEmail; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getTargetType() { return targetType; }
    public void setTargetType(String targetType) { this.targetType = targetType; }
    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public String getTargetLabel() { return targetLabel; }
    public void setTargetLabel(String targetLabel) { this.targetLabel = targetLabel; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
