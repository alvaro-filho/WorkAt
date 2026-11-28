package com.example.backend.models;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_user")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(nullable = false)
    private String userType;

    private LocalDateTime createdAt;

    /** Data de cadastro (as contas antigas, de antes da V3.1, podem não ter). */
    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    // ---- Perfil público (portfólio) ----

    @Column(columnDefinition = "TEXT")
    private String bio;

    /** Especialidades separadas por vírgula (ex.: "Concept art, Ilustração"). */
    @Column(length = 300)
    private String specialties;

    /** Links do portfólio, um por linha (ArtStation, Instagram, site...). */
    @Column(columnDefinition = "TEXT")
    private String links;

    @Column(name = "avatar_stored_name")
    private String avatarStoredName;

    @Column(name = "avatar_content_type", length = 60)
    private String avatarContentType;

    @Column(name = "avatar_updated_at")
    private LocalDateTime avatarUpdatedAt;

    /** Capa do perfil (faixa no topo, estilo rede social). */
    @Column(name = "banner_stored_name")
    private String bannerStoredName;

    @Column(name = "banner_content_type", length = 60)
    private String bannerContentType;

    @Column(name = "banner_updated_at")
    private LocalDateTime bannerUpdatedAt;

    /** Imagem original da foto e da capa (para reajustar o enquadramento depois) e o último enquadramento (JSON). */
    @Column(length = 80)
    private String avatarOriginalStoredName;
    @Column(length = 60)
    private String avatarOriginalContentType;
    @Column(length = 200)
    private String avatarCrop;
    @Column(length = 80)
    private String bannerOriginalStoredName;
    @Column(length = 60)
    private String bannerOriginalContentType;
    @Column(length = 200)
    private String bannerCrop;

    /** Conta excluída: os dados pessoais foram apagados e o login não funciona mais. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean deleted = false;

    /** Permite ser convidado pelo @usuário (além do e-mail). Desligado: só por e-mail. */
    @Column(name = "invite_by_username", nullable = false, columnDefinition = "boolean default true")
    private boolean inviteByUsername = true;

    // ---- Moderação (painel de administração) ----

    /** Suspensa: não entra e some do público. suspendedUntil null = sem prazo. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean suspended = false;

    @Column(name = "suspended_until")
    private LocalDateTime suspendedUntil;

    @Column(name = "suspension_reason", length = 500)
    private String suspensionReason;

    /** Banida: definitivo; o conteúdo foi apagado e o e-mail fica preso a esta conta (não recadastra). */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean banned = false;

    @Column(name = "banned_at")
    private LocalDateTime bannedAt;

    @Column(name = "ban_reason", length = 500)
    private String banReason;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    /** Cota só desta pessoa, em MB (null = a cota padrão do servidor). */
    @Column(name = "storage_quota_mb")
    private Integer storageQuotaMb;

    /** Anotação interna do administrador (a pessoa não vê). */
    @Column(name = "admin_note", columnDefinition = "TEXT")
    private String adminNote;

    /**
     * Conta de confiança: publica direto. Conta nova começa sem confiança (as publicações esperam a aprovação do
     * administrador, e foto e capa ficam travadas). Contas que já existiam antes da V3.1 são de confiança.
     */
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean trusted = true;

    public boolean isTrusted() { return trusted; }
    public void setTrusted(boolean trusted) { this.trusted = trusted; }

    /** Não entra e não aparece: banida, ou suspensa sem prazo ou com o prazo ainda correndo. */
    public boolean isBlocked() {
        return banned || (suspended && (suspendedUntil == null || suspendedUntil.isAfter(LocalDateTime.now())));
    }

    public boolean isSuspended() { return suspended; }
    public void setSuspended(boolean suspended) { this.suspended = suspended; }
    public LocalDateTime getSuspendedUntil() { return suspendedUntil; }
    public void setSuspendedUntil(LocalDateTime suspendedUntil) { this.suspendedUntil = suspendedUntil; }
    public String getSuspensionReason() { return suspensionReason; }
    public void setSuspensionReason(String suspensionReason) { this.suspensionReason = suspensionReason; }
    public boolean isBanned() { return banned; }
    public void setBanned(boolean banned) { this.banned = banned; }
    public LocalDateTime getBannedAt() { return bannedAt; }
    public void setBannedAt(LocalDateTime bannedAt) { this.bannedAt = bannedAt; }
    public String getBanReason() { return banReason; }
    public void setBanReason(String banReason) { this.banReason = banReason; }
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }
    public Integer getStorageQuotaMb() { return storageQuotaMb; }
    public void setStorageQuotaMb(Integer storageQuotaMb) { this.storageQuotaMb = storageQuotaMb; }
    public String getAdminNote() { return adminNote; }
    public void setAdminNote(String adminNote) { this.adminNote = adminNote; }

    // ---- Disponível para trabalho (só artistas) ----

    @Column(name = "available_for_work", nullable = false, columnDefinition = "boolean default false")
    private boolean availableForWork = false;

    /** Formatos aceitos, separados por vírgula (FREELA,PROJETO,CLT,ESTAGIO). */
    @Column(name = "available_formats", length = 60)
    private String availableFormats;

    /** REMOTO, PRESENCIAL ou HIBRIDO. */
    @Column(name = "available_location", length = 12)
    private String availableLocation;

    @Column(name = "available_city", length = 80)
    private String availableCity;

    /** Linha livre ("Livre a partir de janeiro"). */
    @Column(name = "available_note", length = 120)
    private String availableNote;

    /** Quando o selo foi ligado ou mudou (ordena os disponíveis no Explorar). */
    @Column(name = "available_updated_at")
    private LocalDateTime availableUpdatedAt;

    public boolean isAvailableForWork() { return availableForWork; }
    public void setAvailableForWork(boolean availableForWork) { this.availableForWork = availableForWork; }
    public String getAvailableFormats() { return availableFormats; }
    public void setAvailableFormats(String availableFormats) { this.availableFormats = availableFormats; }
    public String getAvailableLocation() { return availableLocation; }
    public void setAvailableLocation(String availableLocation) { this.availableLocation = availableLocation; }
    public String getAvailableCity() { return availableCity; }
    public void setAvailableCity(String availableCity) { this.availableCity = availableCity; }
    public String getAvailableNote() { return availableNote; }
    public void setAvailableNote(String availableNote) { this.availableNote = availableNote; }
    public LocalDateTime getAvailableUpdatedAt() { return availableUpdatedAt; }
    public void setAvailableUpdatedAt(LocalDateTime availableUpdatedAt) { this.availableUpdatedAt = availableUpdatedAt; }

    public boolean isInviteByUsername() { return inviteByUsername; }
    public void setInviteByUsername(boolean inviteByUsername) { this.inviteByUsername = inviteByUsername; }

    public User() {
    }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getSpecialties() { return specialties; }
    public void setSpecialties(String specialties) { this.specialties = specialties; }
    public String getLinks() { return links; }
    public void setLinks(String links) { this.links = links; }
    public String getAvatarStoredName() { return avatarStoredName; }
    public void setAvatarStoredName(String avatarStoredName) { this.avatarStoredName = avatarStoredName; }
    public String getAvatarContentType() { return avatarContentType; }
    public void setAvatarContentType(String avatarContentType) { this.avatarContentType = avatarContentType; }
    public LocalDateTime getAvatarUpdatedAt() { return avatarUpdatedAt; }
    public void setAvatarUpdatedAt(LocalDateTime avatarUpdatedAt) { this.avatarUpdatedAt = avatarUpdatedAt; }
    public String getBannerStoredName() { return bannerStoredName; }
    public void setBannerStoredName(String bannerStoredName) { this.bannerStoredName = bannerStoredName; }
    public String getBannerContentType() { return bannerContentType; }
    public void setBannerContentType(String bannerContentType) { this.bannerContentType = bannerContentType; }
    public String getAvatarOriginalStoredName() { return avatarOriginalStoredName; }
    public void setAvatarOriginalStoredName(String value) { this.avatarOriginalStoredName = value; }
    public String getAvatarOriginalContentType() { return avatarOriginalContentType; }
    public void setAvatarOriginalContentType(String value) { this.avatarOriginalContentType = value; }
    public String getAvatarCrop() { return avatarCrop; }
    public void setAvatarCrop(String value) { this.avatarCrop = value; }
    public String getBannerOriginalStoredName() { return bannerOriginalStoredName; }
    public void setBannerOriginalStoredName(String value) { this.bannerOriginalStoredName = value; }
    public String getBannerOriginalContentType() { return bannerOriginalContentType; }
    public void setBannerOriginalContentType(String value) { this.bannerOriginalContentType = value; }
    public String getBannerCrop() { return bannerCrop; }
    public void setBannerCrop(String value) { this.bannerCrop = value; }
    public LocalDateTime getBannerUpdatedAt() { return bannerUpdatedAt; }
    public void setBannerUpdatedAt(LocalDateTime bannerUpdatedAt) { this.bannerUpdatedAt = bannerUpdatedAt; }

    /** Endereço público da capa (null = o site mostra um degradê). */
    public String bannerUrl() {
        if (bannerStoredName == null || username == null) {
            return null;
        }
        long version = bannerUpdatedAt == null ? 0 : bannerUpdatedAt.toEpochSecond(java.time.ZoneOffset.UTC);
        return "/api/v1/users/" + username + "/banner?v=" + version;
    }

    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }

    /** Endereço público da foto, com a data no fim para o navegador não mostrar a antiga. */
    public String avatarUrl() {
        if (avatarStoredName == null || username == null) {
            return null;
        }
        long version = avatarUpdatedAt == null ? 0 : avatarUpdatedAt.toEpochSecond(java.time.ZoneOffset.UTC);
        return "/api/v1/users/" + username + "/avatar?v=" + version;
    }

    // Getters e Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    // --- Métodos Auxiliares para Compatibilidade ---
    public String getPassword() {
        return passwordHash;
    }

    public void setPassword(String password) {
        this.passwordHash = password;
    }
    // ----------------------------------------------

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public String getUserType() {
        return userType;
    }

    public void setUserType(String userType) {
        this.userType = userType;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}