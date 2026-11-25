package com.example.backend.models;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Arquivo enviado para uma tarefa (entrega, arquivo de trabalho ou imagem final).
 * O conteúdo fica em disco no backend, com nome gerado; aqui ficam só os metadados.
 */
@Entity
@Table(name = "task_file")
public class TaskFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploaded_by_user_id", nullable = false)
    private User uploadedBy;

    @Column(nullable = false, length = 255)
    private String originalName;

    /** Nome no disco (UUID + extensão). Nunca vem do cliente. */
    @Column(nullable = false, unique = true, length = 80)
    private String storedName;

    @Column(nullable = false, length = 120)
    private String contentType;

    @Column(nullable = false)
    private long sizeBytes;

    /** Versão do arquivo dentro da tarefa: 1, 2, 3... */
    @Column(nullable = false)
    private int version;

    /** Imagem final da tarefa (no máximo uma por tarefa). */
    @Column(name = "is_final", nullable = false, columnDefinition = "boolean default false")
    private boolean finalImage = false;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Task getTask() { return task; }
    public void setTask(Task task) { this.task = task; }
    public User getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(User uploadedBy) { this.uploadedBy = uploadedBy; }
    public String getOriginalName() { return originalName; }
    public void setOriginalName(String originalName) { this.originalName = originalName; }
    public String getStoredName() { return storedName; }
    public void setStoredName(String storedName) { this.storedName = storedName; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public boolean isFinalImage() { return finalImage; }
    public void setFinalImage(boolean finalImage) { this.finalImage = finalImage; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
