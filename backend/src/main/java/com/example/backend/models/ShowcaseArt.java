package com.example.backend.models;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "showcase_art")
public class ShowcaseArt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 500)
    private String imageUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "artist_id", nullable = false)
    private User artist;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private User company;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    // Tarefa e imagem final de onde a arte saiu (fluxo novo: "Enviar para a vitrine" na tarefa).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_file_id")
    private TaskFile sourceFile;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NdaStatus ndaStatus = NdaStatus.LOCKED_BY_NDA;

    @Column(columnDefinition = "TEXT")
    private String reviewNote;

    private LocalDate releaseDate;

    /** Quando a arte foi liberada (aprovada). Usado para ordenar o feed do Explorar. */
    private LocalDateTime approvedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public User getArtist() { return artist; }
    public void setArtist(User artist) { this.artist = artist; }
    public User getCompany() { return company; }
    public void setCompany(User company) { this.company = company; }
    public Task getTask() { return task; }
    public void setTask(Task task) { this.task = task; }
    public TaskFile getSourceFile() { return sourceFile; }
    public void setSourceFile(TaskFile sourceFile) { this.sourceFile = sourceFile; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public NdaStatus getNdaStatus() { return ndaStatus; }
    public void setNdaStatus(NdaStatus ndaStatus) { this.ndaStatus = ndaStatus; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public LocalDate getReleaseDate() { return releaseDate; }
    public void setReleaseDate(LocalDate releaseDate) { this.releaseDate = releaseDate; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }

    /**
     * Momento em que a arte ficou pública: a liberação ou, se houver data de lançamento posterior, o início dela.
     * Artes antigas (sem approvedAt) usam a última atualização.
     */
    public LocalDateTime getPublishedAt() {
        LocalDateTime approved = approvedAt != null ? approvedAt : updatedAt;
        if (releaseDate != null && approved != null && releaseDate.atStartOfDay().isAfter(approved)) {
            return releaseDate.atStartOfDay();
        }
        return approved;
    }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
