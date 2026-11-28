package com.example.backend.controllers;

import com.example.backend.models.User;
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

    /** Opcional (testes antigos constroem sem ele): travas de VPN, banimento e registro de acesso. */
    private com.example.backend.services.SecurityGate securityGate;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setSecurityGate(com.example.backend.services.SecurityGate securityGate) {
        this.securityGate = securityGate;
    }

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
        User user = currentUser.require(authentication);
        if (securityGate != null) securityGate.checkPosting(user, com.example.backend.models.SecurityEvent.Type.COMMENT);
        return comments.addToPost(postId, user,
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
        User user = currentUser.require(authentication);
        if (securityGate != null) securityGate.checkPosting(user, com.example.backend.models.SecurityEvent.Type.COMMENT);
        return comments.addToProject(projectId, user,
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
