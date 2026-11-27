package com.example.backend.models;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

/**
 * Mensagem da conversa entre o estúdio e um candidato, presa à candidatura (JobInterest).
 * Some junto com a candidatura; não é chat livre entre pessoas.
 */
@Entity
@Table(name = "job_interest_message",
        indexes = @Index(name = "idx_job_interest_message_interest", columnList = "interest_id, id"))
public class JobInterestMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "interest_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private JobInterest interest;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User author;

    @Column(nullable = false, length = 1000)
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
    public JobInterest getInterest() { return interest; }
    public void setInterest(JobInterest interest) { this.interest = interest; }
    public User getAuthor() { return author; }
    public void setAuthor(User author) { this.author = author; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
