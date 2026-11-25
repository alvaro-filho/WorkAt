package com.example.backend.dto;

import com.example.backend.models.Project;
import com.example.backend.models.ProjectRole;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.ProjectType;
import com.example.backend.models.User;
import com.example.backend.services.ProjectAccessService;

/**
 * Projeto como o usuário logado o enxerga: inclui o papel dele (OWNER/MEMBER) e quem é o dono.
 * Só deve ser montado para quem já passou pela checagem de participação.
 */
public record ProjectResponse(
        Long id,
        String name,
        String slug,
        String description,
        ProjectType type,
        ProjectStatus status,
        ProjectRole myRole,
        UserSummary owner,
        boolean contractorsSeeAllTasks
) {
    public static ProjectResponse from(Project project, User viewer) {
        ProjectRole role = ProjectAccessService.isOwner(project, viewer) ? ProjectRole.OWNER : ProjectRole.MEMBER;
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getSlug(),
                project.getDescription(),
                project.getType(),
                project.getStatus(),
                role,
                UserSummary.from(project.getCreatedByUser()),
                project.isContractorsSeeAllTasks()
        );
    }
}
