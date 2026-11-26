package com.example.backend.controllers;

import com.example.backend.dto.UserSummary;
import com.example.backend.models.TaskComment;
import com.example.backend.services.CurrentUser;
import com.example.backend.services.TaskCommentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
public class TaskCommentController {

    private final TaskCommentService comments;
    private final CurrentUser currentUser;

    public TaskCommentController(TaskCommentService comments, CurrentUser currentUser) {
        this.comments = comments;
        this.currentUser = currentUser;
    }

    public record CommentRequest(String body, Long fileId) {
    }

    public record CommentResponse(Long id, String kind, String body, UserSummary author, Long fileId,
                                  Integer fileVersion, String fileName, LocalDateTime createdAt) {
        static CommentResponse from(TaskComment c) {
            var file = c.getFile();
            return new CommentResponse(c.getId(), c.getKind(), c.getBody(), UserSummary.from(c.getAuthor()),
                    file == null ? null : file.getId(), file == null ? null : file.getVersion(),
                    file == null ? null : file.getOriginalName(), c.getCreatedAt());
        }
    }

    @GetMapping("/api/v1/tasks/{taskId}/comments")
    public List<CommentResponse> list(@PathVariable Long taskId, Authentication authentication) {
        return comments.list(taskId, currentUser.require(authentication)).stream().map(CommentResponse::from).toList();
    }

    @PostMapping("/api/v1/tasks/{taskId}/comments")
    public ResponseEntity<CommentResponse> add(@PathVariable Long taskId, @RequestBody CommentRequest request,
                                               Authentication authentication) {
        var saved = comments.add(taskId, currentUser.require(authentication),
                request == null ? null : request.body(), request == null ? null : request.fileId());
        return ResponseEntity.status(HttpStatus.CREATED).body(CommentResponse.from(saved));
    }

    @DeleteMapping("/api/v1/comments/{commentId}")
    public ResponseEntity<Void> delete(@PathVariable Long commentId, Authentication authentication) {
        comments.delete(commentId, currentUser.require(authentication));
        return ResponseEntity.noContent().build();
    }
}
