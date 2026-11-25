package com.example.backend.repositories;

import com.example.backend.models.NdaStatus;
import com.example.backend.models.Project;
import com.example.backend.models.ShowcaseArt;
import com.example.backend.models.Task;
import com.example.backend.models.TaskFile;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
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

    /** Portfólio público de um usuário: artes liberadas em que ele é o artista ou a parte contratante. */
    @EntityGraph(attributePaths = {"artist", "company", "project"})
    @Query("select art from ShowcaseArt art where (art.artist = :user or art.company = :user) "
            + "and art.ndaStatus = :status and (art.releaseDate is null or art.releaseDate <= :today) "
            + "order by art.createdAt desc")
    List<ShowcaseArt> findPublicArtsOf(@Param("user") User user, @Param("status") NdaStatus status,
                                       @Param("today") LocalDate today);

    @EntityGraph(attributePaths = {"artist", "company", "project"})
    List<ShowcaseArt> findByProjectOrderByCreatedAtDesc(Project project);

    Optional<ShowcaseArt> findFirstByTask(Task task);

    boolean existsBySourceFile(TaskFile sourceFile);

    List<ShowcaseArt> findByTask(Task task);

    List<ShowcaseArt> findByProject(Project project);
}
