package com.example.backend.models;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

/**
 * Estado do Canvas infinito de uma tarefa (painel de referências estilo PureRef), em JSON.
 * Apagar a tarefa apaga o Canvas junto (ON DELETE CASCADE no banco).
 */
@Entity
@Table(name = "task_canvas")
public class TaskCanvas {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Task task;

    /** JSON com os itens (notas e imagens reduzidas em data URL). */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_user_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User updatedBy;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void touch() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Task getTask() { return task; }
    public void setTask(Task task) { this.task = task; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public User getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(User updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
