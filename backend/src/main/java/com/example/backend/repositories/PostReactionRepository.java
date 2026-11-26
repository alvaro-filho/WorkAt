package com.example.backend.repositories;

import com.example.backend.models.Post;
import com.example.backend.models.PostReaction;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PostReactionRepository extends JpaRepository<PostReaction, Long> {

    Optional<PostReaction> findByPostAndUserAndType(Post post, User user, PostReaction.Type type);

    /** Linhas [postId, tipo, quantidade] das publicações pedidas. */
    @Query("select r.post.id, r.type, count(r) from PostReaction r where r.post.id in :ids group by r.post.id, r.type")
    List<Object[]> countByPosts(@Param("ids") Collection<Long> ids);

    /** Linhas [postId, tipo] das reações de uma pessoa nas publicações pedidas. */
    @Query("select r.post.id, r.type from PostReaction r where r.user = :user and r.post.id in :ids")
    List<Object[]> findMine(@Param("user") User user, @Param("ids") Collection<Long> ids);

    /** Republicados ou salvos de alguém, mais recentes primeiro. */
    @EntityGraph(attributePaths = {"post", "post.author", "post.project", "post.task"})
    List<PostReaction> findByUserAndTypeOrderByIdDesc(User user, PostReaction.Type type);
}
