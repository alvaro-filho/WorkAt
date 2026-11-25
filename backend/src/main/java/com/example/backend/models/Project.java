package com.example.backend.models;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.Objects;

@Entity
@Table(name = "project")
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(unique = true, nullable = false)
    private String slug; // Usado para URLs amigáveis

    @Column(columnDefinition = "TEXT")
    private String description;

    // O default no banco faz os projetos antigos virarem PERSONAL quando a coluna é criada.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'PERSONAL'")
    private ProjectType type = ProjectType.PERSONAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'ACTIVE'")
    private ProjectStatus status = ProjectStatus.ACTIVE;

    // Só vale no corporativo: se true, contratados veem todas as tarefas, e não só as atribuídas a eles.
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean contractorsSeeAllTasks = false;

    // Só vale no corporativo: com NDA ligado, as artes enviadas à vitrine nascem travadas e só o dono libera.
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean ndaEnabled = false;

    // WIP automático: o projeto fica público e cada imagem enviada numa tarefa vira uma publicação no feed.
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean autoWip = false;

    // Quando o projeto ficou público pela primeira vez.
    private java.time.LocalDateTime publicSince;

    // Só vale no corporativo com NDA: até esta data, nada do projeto aparece em público.
    private java.time.LocalDate ndaReleaseDate;

    // Relacionamento opcional com o Criador do Projeto (usuário)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    @JsonIgnore
    private User createdByUser;

    // Adicionar mais campos conforme necessário (ex: status, ownerId)

    public Project() {
        // Construtor padrão JPA
    }

    // Getters e Setters (Devem ser implementados ou usados Lombok)

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public ProjectType getType() {
        return type;
    }

    public void setType(ProjectType type) {
        this.type = type;
    }

    public ProjectStatus getStatus() {
        return status;
    }

    public void setStatus(ProjectStatus status) {
        this.status = status;
    }

    public boolean isContractorsSeeAllTasks() {
        return contractorsSeeAllTasks;
    }

    public void setContractorsSeeAllTasks(boolean contractorsSeeAllTasks) {
        this.contractorsSeeAllTasks = contractorsSeeAllTasks;
    }

    public boolean isNdaEnabled() {
        return ndaEnabled;
    }

    public void setNdaEnabled(boolean ndaEnabled) {
        this.ndaEnabled = ndaEnabled;
    }

    public User getCreatedByUser() {
        return createdByUser;
    }

    public void setCreatedByUser(User createdByUser) {
        this.createdByUser = createdByUser;
    }

    // Implementar equals() e hashCode() baseado nos campos de identidade.
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Project project = (Project) o;
        return Objects.equals(id, project.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
    public boolean isAutoWip() {
        return autoWip;
    }

    public void setAutoWip(boolean autoWip) {
        this.autoWip = autoWip;
    }

    public java.time.LocalDateTime getPublicSince() {
        return publicSince;
    }

    public void setPublicSince(java.time.LocalDateTime publicSince) {
        this.publicSince = publicSince;
    }

    public java.time.LocalDate getNdaReleaseDate() {
        return ndaReleaseDate;
    }

    public void setNdaReleaseDate(java.time.LocalDate ndaReleaseDate) {
        this.ndaReleaseDate = ndaReleaseDate;
    }
}
