package com.example.backend.controllers;

import com.example.backend.dto.CommentThreadResponse;
import com.example.backend.services.CurrentUser;
import com.example.backend.services.PostCommentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Comentários de feedback: em publicações e na página pública dos projetos.
 * Ler é público para o que já é público; comentar, ligar/desligar e apagar exigem login.
 */
@RestController
public class PostCommentController {

    private final PostCommentService comments;
    private final CurrentUser currentUser;

    public PostCommentController(PostCommentService comments, CurrentUser currentUser) {
        this.comments = comments;
        this.currentUser = currentUser;
    }

    public record CommentRequest(String body, Long parentId) {
    }

    public record CommentSettings(Boolean enabled) {
    }

    @GetMapping("/api/v1/posts/{postId}/comments")
    public CommentThreadResponse postThread(@PathVariable Long postId, Authentication authentication) {
        return comments.threadForPost(postId, currentUser.optional(authentication));
    }

    @PostMapping("/api/v1/posts/{postId}/comments")
    public CommentThreadResponse addToPost(@PathVariable Long postId, @RequestBody CommentRequest request,
                                           Authentication authentication) {
        return comments.addToPost(postId, currentUser.require(authentication),
                request == null ? null : request.body(), request == null ? null : request.parentId());
    }

    @PutMapping("/api/v1/posts/{postId}/comments/settings")
    public CommentThreadResponse postSettings(@PathVariable Long postId, @RequestBody CommentSettings request,
                                              Authentication authentication) {
        return comments.setPostComments(postId, currentUser.require(authentication),
                request != null && Boolean.TRUE.equals(request.enabled()));
    }

    @GetMapping("/api/v1/projects/{projectId}/public/comments")
    public CommentThreadResponse projectThread(@PathVariable Long projectId, Authentication authentication) {
        return comments.threadForProject(projectId, currentUser.optional(authentication));
    }

    @PostMapping("/api/v1/projects/{projectId}/public/comments")
    public CommentThreadResponse addToProject(@PathVariable Long projectId, @RequestBody CommentRequest request,
                                              Authentication authentication) {
        return comments.addToProject(projectId, currentUser.require(authentication),
                request == null ? null : request.body(), request == null ? null : request.parentId());
    }

    @PutMapping("/api/v1/projects/{projectId}/comments/settings")
    public CommentThreadResponse projectSettings(@PathVariable Long projectId, @RequestBody CommentSettings request,
                                                 Authentication authentication) {
        return comments.setProjectComments(projectId, currentUser.require(authentication),
                request != null && Boolean.TRUE.equals(request.enabled()));
    }

    @DeleteMapping("/api/v1/post-comments/{commentId}")
    public ResponseEntity<Void> delete(@PathVariable Long commentId, Authentication authentication) {
        comments.delete(commentId, currentUser.require(authentication));
        return ResponseEntity.noContent().build();
    }
}
