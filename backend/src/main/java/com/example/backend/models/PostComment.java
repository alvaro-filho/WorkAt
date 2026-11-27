package com.example.backend.models;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

/**
 * Comentário de feedback numa publicação ou na página pública de um projeto (um dos dois).
 * Resposta = comentário com parent (um nível só). Não vira post no perfil de quem comentou.
 * Apagado com respostas fica "removido" (sem texto) para a conversa não perder o sentido.
 */
@Entity
@Table(name = "post_comment", indexes = {
        @Index(name = "idx_post_comment_post", columnList = "post_id, created_at"),
        @Index(name = "idx_post_comment_project", columnList = "project_id, created_at"),
        @Index(name = "idx_post_comment_author", columnList = "author_id, created_at")
})
public class PostComment {

    public static final int MAX_LENGTH = 1000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private PostComment parent;

    @Column(nullable = false, length = MAX_LENGTH)
    private String body;

    @Column(nullable = false)
    private boolean removed = false;

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
    public Post getPost() { return post; }
    public void setPost(Post post) { this.post = post; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public User getAuthor() { return author; }
    public void setAuthor(User author) { this.author = author; }
    public PostComment getParent() { return parent; }
    public void setParent(PostComment parent) { this.parent = parent; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public boolean isRemoved() { return removed; }
    public void setRemoved(boolean removed) { this.removed = removed; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
