package com.example.backend.dto;

import com.example.backend.models.ShowcaseArt;
import java.time.LocalDate;

public record PublicShowcaseResponse(
        Long id,
        String title,
        String description,
        String imageUrl,
        String artistName,
        String companyName,
        LocalDate releaseDate
) {
    public static PublicShowcaseResponse from(ShowcaseArt art) {
        return new PublicShowcaseResponse(art.getId(), art.getTitle(), art.getDescription(), art.getImageUrl(),
                art.getArtist().getFullName(), art.getCompany().getFullName(), art.getReleaseDate());
    }
}
