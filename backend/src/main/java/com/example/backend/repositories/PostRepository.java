package com.example.backend.repositories;

import com.example.backend.models.Post;
import com.example.backend.models.PostKind;
import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PostRepository extends JpaRepository<Post, Long> {

    /** NDA liberado ou inexistente. Mesma regra de PostService.ndaBlocks, escrita em JPQL. */
    String NDA_OPEN = "(pr.type <> com.example.backend.models.ProjectType.CORPORATE or pr.ndaEnabled = false "
            + "or (pr.ndaReleaseDate is not null and pr.ndaReleaseDate <= :today))";

    /** Feed Publicações: só o que é público agora, mais novo primeiro, paginado por id. Espelha PostService.isPublic. */
    @EntityGraph(attributePaths = {"author", "project", "task"})
    @Query("select p from Post p left join p.project pr left join p.task t where p.id < :before and ("
            + "pr is null"
            + " or (p.kind = com.example.backend.models.PostKind.STANDALONE and " + NDA_OPEN + ")"
            + " or (p.kind <> com.example.backend.models.PostKind.STANDALONE and pr.autoWip = true and " + NDA_OPEN
            + " and (t is null or t.hiddenFromPublic = false))"
            + ") order by p.id desc")
    List<Post> findPublicFeed(@Param("before") long before, @Param("today") LocalDate today, Pageable page);

    @EntityGraph(attributePaths = {"author", "project", "task"})
    List<Post> findByAuthorOrderByIdDesc(User author);

    @EntityGraph(attributePaths = {"author", "project", "task"})
    List<Post> findByProjectOrderByIdDesc(Project project);

    List<Post> findByProject(Project project);

    List<Post> findByTask(Task task);

    Optional<Post> findFirstByAuthorAndTaskAndKindAndCreatedAtAfterOrderByIdDesc(User author, Task task, PostKind kind,
                                                                               LocalDateTime since);

    boolean existsByProjectAndKind(Project project, PostKind kind);
}
