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
        String companyName,
        Long projectId,
        LocalDateTime createdAt
) {
    public static ShowcaseResponse from(ShowcaseArt art) {
        return new ShowcaseResponse(art.getId(), art.getTitle(), art.getDescription(), art.getImageUrl(),
                art.getNdaStatus(), art.getReviewNote(), art.getReleaseDate(), art.getArtist().getFullName(),
                art.getCompany().getFullName(), art.getProject() == null ? null : art.getProject().getId(),
                art.getCreatedAt());
    }
}
