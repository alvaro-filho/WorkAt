package com.example.backend.dto;

import java.time.LocalDateTime;

/** content: JSON do Canvas. Na resposta, também quem salvou por último e quando. */
public record TaskCanvasDto(String content, String updatedByName, LocalDateTime updatedAt) {
}
