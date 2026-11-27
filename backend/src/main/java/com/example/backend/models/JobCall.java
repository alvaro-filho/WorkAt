package com.example.backend.models;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Chamada: uma vaga ou um job com campos fixos, publicada por uma conta Empresa.
 * Artistas respondem com "Tenho interesse" (JobInterest); o estúdio convida quem escolher para um projeto corporativo.
 */
@Entity
@Table(name = "job_call", indexes = {
        @Index(name = "idx_job_call_status", columnList = "status, created_at"),
        @Index(name = "idx_job_call_author", columnList = "author_id, created_at")
})
public class JobCall {

    public enum Role { CONCEPT, ILUSTRACAO, MODELAGEM_3D, ANIMACAO, HQ, UI, OUTRO }

    public enum Format { FREELA, PROJETO, CLT, ESTAGIO }

    public enum Location { REMOTO, PRESENCIAL, HIBRIDO }

    /** OPEN vira fechada sozinha depois de closesOn (ver isOpen). */
    public enum Status { OPEN, CLOSED, FILLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User author;

    @Column(nullable = false, length = 120)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "call_role", nullable = false, length = 20)
    private Role role;

    @Column(nullable = false, length = 3000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Format format;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Location location;

    /** Cidade, quando presencial ou híbrido. */
    @Column(length = 80)
    private String city;

    /** Faixa de pagamento em reais, opcional: o estúdio decide se mostra. */
    @Column(name = "pay_min")
    private Integer payMin;

    @Column(name = "pay_max")
    private Integer payMax;

    /** Último dia para manifestar interesse. */
    @Column(name = "closes_on", nullable = false)
    private LocalDate closesOn;

    /** Só avisa: o NDA vale de verdade no projeto que nascer da Chamada. */
    @Column(nullable = false)
    private boolean nda;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.OPEN;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    /** Aberta de verdade: status OPEN e o prazo ainda não passou. */
    public boolean isOpen(LocalDate today) {
        return status == Status.OPEN && !closesOn.isBefore(today);
    }

    /** O status que as telas mostram (OPEN com prazo vencido aparece como CLOSED). */
    public Status effectiveStatus(LocalDate today) {
        return status == Status.OPEN && closesOn.isBefore(today) ? Status.CLOSED : status;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getAuthor() { return author; }
    public void setAuthor(User author) { this.author = author; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Format getFormat() { return format; }
    public void setFormat(Format format) { this.format = format; }
    public Location getLocation() { return location; }
    public void setLocation(Location location) { this.location = location; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public Integer getPayMin() { return payMin; }
    public void setPayMin(Integer payMin) { this.payMin = payMin; }
    public Integer getPayMax() { return payMax; }
    public void setPayMax(Integer payMax) { this.payMax = payMax; }
    public LocalDate getClosesOn() { return closesOn; }
    public void setClosesOn(LocalDate closesOn) { this.closesOn = closesOn; }
    public boolean isNda() { return nda; }
    public void setNda(boolean nda) { this.nda = nda; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
