package com.example.backend.dto;

import com.example.backend.models.TaskFile;
import com.example.backend.services.TaskFileService;

import java.time.LocalDateTime;

public record TaskFileResponse(
        Long id,
        Long taskId,
        String originalName,
        String contentType,
        long sizeBytes,
        int version,
        boolean finalImage,
        boolean image,
        UserSummary uploadedBy,
        LocalDateTime createdAt
) {
    public static TaskFileResponse from(TaskFile file) {
        return new TaskFileResponse(
                file.getId(),
                file.getTask().getId(),
                file.getOriginalName(),
                file.getContentType(),
                file.getSizeBytes(),
                file.getVersion(),
                file.isFinalImage(),
                TaskFileService.isPreviewableImage(file.getContentType()),
                UserSummary.from(file.getUploadedBy()),
                file.getCreatedAt()
        );
    }
}
