package com.example.backend.models;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

/** Comentário na tarefa, opcionalmente sobre uma versão de arquivo. Some junto com a tarefa. */
@Entity
@Table(name = "task_comment", indexes = @Index(name = "idx_comment_task", columnList = "task_id, created_at"))
public class TaskComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_user_id", nullable = false)
    private User author;

    /** Versão comentada; se o arquivo for apagado, o comentário fica sem a referência. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_file_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private TaskFile file;

    /** COMMENT, CHANGES_REQUESTED ou APPROVED: as decisões da revisão também aparecem na conversa. */
    @Column(nullable = false, length = 30)
    private String kind = "COMMENT";

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

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
    public Task getTask() { return task; }
    public void setTask(Task task) { this.task = task; }
    public User getAuthor() { return author; }
    public void setAuthor(User author) { this.author = author; }
    public TaskFile getFile() { return file; }
    public void setFile(TaskFile file) { this.file = file; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
