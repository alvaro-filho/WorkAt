package com.example.backend.repositories;

import com.example.backend.models.NdaStatus;
import com.example.backend.models.ShowcaseArt;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ShowcaseArtRepository extends JpaRepository<ShowcaseArt, Long> {
    @EntityGraph(attributePaths = {"artist", "company", "project"})
    List<ShowcaseArt> findByArtistOrderByCreatedAtDesc(User artist);

    @EntityGraph(attributePaths = {"artist", "company", "project"})
    List<ShowcaseArt> findByCompanyOrderByCreatedAtDesc(User company);

    @EntityGraph(attributePaths = {"artist", "company", "project"})
    Optional<ShowcaseArt> findByIdAndCompany(Long id, User company);

    @EntityGraph(attributePaths = {"artist", "company"})
    @Query("select art from ShowcaseArt art where art.ndaStatus = :status "
            + "and (art.releaseDate is null or art.releaseDate <= :today) order by art.createdAt desc")
    List<ShowcaseArt> findPublicArts(@Param("status") NdaStatus status, @Param("today") LocalDate today);
}
