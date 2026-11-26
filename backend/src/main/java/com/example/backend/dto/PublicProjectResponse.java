package com.example.backend.dto;

import com.example.backend.models.ProjectStatus;
import com.example.backend.models.ProjectType;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Visão pública do projeto: só as atualizações. Cada tarefa vira título, subtítulo (descrição) e imagens.
 * Sem prazos, prioridades, responsáveis ou arquivos que não sejam imagem.
 */
public record PublicProjectResponse(
        Long id,
        String name,
        String description,
        ProjectType type,
        ProjectStatus status,
        UserSummary owner,
        List<UserSummary> members,
        LocalDateTime publicSince,
        /** Falso quando quem vê é participante pré-visualizando um projeto ainda privado. */
        boolean isPublic,
        boolean viewerParticipates,
        /** Arquivo usado como capa (escolhido pelo diretor); null = a imagem mais recente. */
        Long coverFileId,
        List<Update> updates
) {
    public record Update(
            Long taskId,
            String title,
            String subtitle,
            boolean done,
            LocalDateTime firstImageAt,
            LocalDateTime lastImageAt,
            List<Image> images
    ) {
    }

    public record Image(Long fileId, String url, boolean finalImage, LocalDateTime createdAt) {
    }
}
