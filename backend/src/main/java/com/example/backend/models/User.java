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

    /** Conta excluída: os dados pessoais foram apagados e o login não funciona mais. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean deleted = false;

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