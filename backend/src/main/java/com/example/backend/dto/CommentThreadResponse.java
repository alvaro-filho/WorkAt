package com.example.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Comentários de uma publicação ou projeto, já agrupados: cada comentário com as respostas dele.
 * enabled: se aceita comentários novos. canToggle: quem está vendo pode ligar/desligar.
 */
public record CommentThreadResponse(boolean enabled, boolean canToggle, int count, List<Comment> comments) {

    public record Comment(Long id, UserSummary author, String body, boolean removed, LocalDateTime createdAt,
                          boolean canDelete, List<Comment> replies) {
    }
}
