package com.example.backend.repositories;

import com.example.backend.models.Post;
import com.example.backend.models.PostComment;
import com.example.backend.models.Project;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface PostCommentRepository extends JpaRepository<PostComment, Long> {

    @EntityGraph(attributePaths = {"author", "parent"})
    List<PostComment> findByPostOrderByIdAsc(Post post);

    @EntityGraph(attributePaths = {"author", "parent"})
    List<PostComment> findByProjectOrderByIdAsc(Project project);

    boolean existsByParent(PostComment parent);

    List<PostComment> findByAuthor(com.example.backend.models.User author);

    /** Limite anti-spam: quantos comentários a pessoa fez desde um momento. */
    long countByAuthorAndCreatedAtAfter(User author, LocalDateTime since);

    /** Linhas [postId, quantidade] dos comentários visíveis (não removidos) das publicações pedidas. */
    @Query("select c.post.id, count(c) from PostComment c where c.post.id in :ids and c.removed = false group by c.post.id")
    List<Object[]> countByPosts(@Param("ids") Collection<Long> ids);
}
