package com.example.backend.models;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

/**
 * Curtir, republicar ou salvar uma publicação. Uma linha por pessoa, publicação e tipo.
 * Apagar a publicação (ou a conta) apaga as reações junto.
 */
@Entity
@Table(name = "post_reaction",
        uniqueConstraints = @UniqueConstraint(name = "uk_post_reaction", columnNames = {"post_id", "user_id", "type"}),
        indexes = @Index(name = "idx_post_reaction_user", columnList = "user_id, type, created_at"))
public class PostReaction {

    public enum Type { LIKE, REPOST, SAVE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Type type;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public static PostReaction of(Post post, User user, Type type) {
        PostReaction reaction = new PostReaction();
        reaction.post = post;
        reaction.user = user;
        reaction.type = type;
        return reaction;
    }

    public Long getId() { return id; }
    public Post getPost() { return post; }
    public User getUser() { return user; }
    public Type getType() { return type; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
