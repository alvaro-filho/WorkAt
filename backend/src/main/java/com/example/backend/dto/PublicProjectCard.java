package com.example.backend.dto;

import com.example.backend.models.ProjectType;

import java.time.LocalDateTime;

/** Projeto aberto ao público, como aparece na aba Projetos do Explorar. */
public record PublicProjectCard(
        Long id,
        String name,
        String description,
        ProjectType type,
        /** Diretor do projeto (quem criou ou recebeu a posse). */
        UserSummary director,
        String coverUrl,
        int imageCount,
        LocalDateTime lastActivityAt
) {
}
