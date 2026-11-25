package com.example.backend.dto;

import com.example.backend.models.PostKind;
import com.example.backend.models.ProjectType;
import com.example.backend.models.TaskStatus;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Publicação como aparece no feed, no perfil e na visão pública.
 * label: "WIP" ou "FINAL" (imagem final da tarefa); vazio no post avulso sem tarefa e no aviso de projeto público.
 * isPublic: falso quando só o autor e os participantes do projeto conseguem ver (projeto privado ou NDA).
 */
public record PostResponse(
        Long id,
        PostKind kind,
        String label,
        String title,
        String subtitle,
        UserSummary author,
        ProjectRef project,
        TaskRef task,
        List<ImageRef> images,
        boolean hiddenFromPortfolio,
        boolean isPublic,
        LocalDateTime createdAt
) {
    public record ProjectRef(Long id, String name, ProjectType type) {
    }

    public record TaskRef(Long id, String title, TaskStatus status) {
    }

    public record ImageRef(Long id, String url) {
    }
}
