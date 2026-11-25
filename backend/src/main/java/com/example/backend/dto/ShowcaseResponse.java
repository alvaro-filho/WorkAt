package com.example.backend.dto;

import com.example.backend.models.NdaStatus;
import com.example.backend.models.ShowcaseArt;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record ShowcaseResponse(
        Long id,
        String title,
        String description,
        String imageUrl,
        NdaStatus ndaStatus,
        String reviewNote,
        LocalDate releaseDate,
        String artistName,
        String artistUsername,
        String companyName,
        Long projectId,
        String projectName,
        Long taskId,
        LocalDateTime createdAt
) {
    public static ShowcaseResponse from(ShowcaseArt art) {
        return new ShowcaseResponse(art.getId(), art.getTitle(), art.getDescription(), imageUrlOf(art),
                art.getNdaStatus(), art.getReviewNote(), art.getReleaseDate(), art.getArtist().getFullName(),
                art.getArtist().getUsername(), art.getCompany().getFullName(),
                art.getProject() == null ? null : art.getProject().getId(),
                art.getProject() == null ? null : art.getProject().getName(),
                art.getTask() == null ? null : art.getTask().getId(),
                art.getCreatedAt());
    }

    /** Artes do fluxo novo usam a imagem final da tarefa, servida pelo backend; as antigas, a URL externa. */
    public static String imageUrlOf(ShowcaseArt art) {
        return art.getSourceFile() != null ? "/api/v1/showcase/" + art.getId() + "/image" : art.getImageUrl();
    }
}
