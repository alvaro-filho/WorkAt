package com.example.backend.models;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * "Tenho interesse" de um artista numa Chamada: uma por artista e Chamada, com mensagem e até 6 trabalhos
 * do próprio portfólio. Só o autor da Chamada vê a lista; o artista vê o status da própria candidatura.
 */
@Entity
@Table(name = "job_interest",
        uniqueConstraints = @UniqueConstraint(name = "uk_job_interest", columnNames = {"call_id", "artist_id"}),
        indexes = @Index(name = "idx_job_interest_artist", columnList = "artist_id, created_at"))
public class JobInterest {

    public enum Status { SENT, SEEN, INVITED, NOT_SELECTED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "call_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private JobCall call;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "artist_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User artist;

    @Column(nullable = false, length = 600)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 14)
    private Status status = Status.SENT;

    /** Publicações do portfólio escolhidas (ids; uma publicação apagada some sozinha da lista). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "job_interest_work", joinColumns = @JoinColumn(name = "interest_id"))
    @Column(name = "post_id", nullable = false)
    @OrderColumn(name = "position")
    private List<Long> workPostIds = new ArrayList<>();

    /** Projeto para o qual o artista foi convidado a partir desta candidatura. */
    @Column(name = "project_id")
    private Long projectId;

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
    public JobCall getCall() { return call; }
    public void setCall(JobCall call) { this.call = call; }
    public User getArtist() { return artist; }
    public void setArtist(User artist) { this.artist = artist; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public List<Long> getWorkPostIds() { return workPostIds; }
    public void setWorkPostIds(List<Long> workPostIds) { this.workPostIds = workPostIds; }
    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
