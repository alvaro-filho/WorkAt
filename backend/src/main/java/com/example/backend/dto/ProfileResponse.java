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
        /** Posts avulsos que aparecem no portfólio (não ocultos). Os projetos públicos ficam em projects. */
        List<PostResponse> portfolio,
        /** Aba Posts: tudo o que a pessoa publicou e o visitante pode ver. */
        List<PostResponse> posts,
        List<ProfileProject> projects,
        int hiddenPersonalProjects,
        List<HeatmapDTO> heatmap,
        String bio,
        List<String> specialties,
        List<String> links,
        String bannerUrl,
        /** Publicações que a pessoa republicou (aparecem na aba Posts com "republicou"). */
        List<Repost> reposts,
        /** Itens salvos: só a própria pessoa vê; para os outros vem vazio. */
        List<PostResponse> saved,
        /** "Disponível para trabalho": null quando o selo está desligado (ou a conta é de estúdio). */
        ArtistDtos.Availability availability
) {
    public record Repost(PostResponse post, LocalDateTime repostedAt) {
    }

    public static List<String> split(String text, String separator) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(text.split(separator)).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

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
            String ownerName,
            /** Projeto público (WIP automático): aparece no portfólio e tem visão pública. */
            boolean publicView,
            String coverUrl,
            /** Publicação pública mais recente do projeto (ordena o portfólio). */
            LocalDateTime lastActivityAt
    ) {
        public static ProfileProject masked(ProjectType type, ProjectRole role, ProjectStatus status, String ownerName) {
            return new ProfileProject(null, null, null, type, role, status, true, true, ownerName, false, null, null);
        }
    }
}
