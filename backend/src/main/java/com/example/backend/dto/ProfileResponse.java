package com.example.backend.dto;

import com.example.backend.models.ProjectRole;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.ProjectType;

import java.time.LocalDateTime;
import java.util.List;

public record ProfileResponse(
        UserSummary user,
        boolean me,
        LocalDateTime memberSince,
        List<PublicShowcaseResponse> portfolio,
        List<ProfileProject> projects,
        int hiddenPersonalProjects,
        List<HeatmapDTO> heatmap
) {
    /**
     * Projeto como aparece no perfil. Mascarado (NDA): sem id, nome ou descrição, só para quem é o contratante.
     */
    public record ProfileProject(
            Long id,
            String name,
            String description,
            ProjectType type,
            ProjectRole role,
            ProjectStatus status,
            boolean nda,
            boolean masked,
            String ownerName
    ) {
        public static ProfileProject masked(ProjectType type, ProjectRole role, ProjectStatus status, String ownerName) {
            return new ProfileProject(null, null, null, type, role, status, true, true, ownerName);
        }
    }
}
