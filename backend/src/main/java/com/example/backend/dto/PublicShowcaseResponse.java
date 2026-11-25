package com.example.backend.dto;

import com.example.backend.models.ShowcaseArt;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record PublicShowcaseResponse(
        Long id,
        String title,
        String description,
        String imageUrl,
        String artistName,
        String artistUsername,
        String companyName,
        String companyUsername,
        String projectName,
        LocalDate releaseDate,
        LocalDateTime publishedAt
) {
    public static PublicShowcaseResponse from(ShowcaseArt art) {
        return new PublicShowcaseResponse(art.getId(), art.getTitle(), art.getDescription(),
                ShowcaseResponse.imageUrlOf(art), art.getArtist().getFullName(), art.getArtist().getUsername(),
                art.getCompany().getFullName(), art.getCompany().getUsername(),
                art.getProject() == null ? null : art.getProject().getName(), art.getReleaseDate(),
                art.getPublishedAt());
    }
}
