package com.example.backend.controllers;

import com.example.backend.dto.TaskFileResponse;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.TaskFileService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Entregas das tarefas. O download sempre exige token e participação no projeto.
 */
@RestController
public class TaskFileController {

    private final TaskFileService taskFileService;
    private final UserRepository userRepository;

    public TaskFileController(TaskFileService taskFileService, UserRepository userRepository) {
        this.taskFileService = taskFileService;
        this.userRepository = userRepository;
    }

    @GetMapping("/api/v1/tasks/{taskId}/files")
    public ResponseEntity<List<TaskFileResponse>> list(@PathVariable Long taskId, Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(taskFileService.list(taskId, user).stream().map(TaskFileResponse::from).toList());
    }

    @PostMapping(value = "/api/v1/tasks/{taskId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<TaskFileResponse> upload(@PathVariable Long taskId,
                                                   @RequestParam("file") MultipartFile file,
                                                   @RequestParam(value = "final", defaultValue = "false") boolean markAsFinal,
                                                   Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(TaskFileResponse.from(taskFileService.upload(taskId, user, file, markAsFinal)));
    }

    /**
     * Conteúdo do arquivo. Imagens de preview vão inline; o resto vai como download.
     * nosniff impede o navegador de "adivinhar" um tipo executável.
     */
    @GetMapping("/api/v1/files/{fileId}/content")
    public ResponseEntity<Resource> content(@PathVariable Long fileId, Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        TaskFileService.StoredFile stored = taskFileService.load(fileId, user);
        boolean inline = TaskFileService.isPreviewableImage(stored.file().getContentType());
        ContentDisposition disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(stored.file().getOriginalName(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(stored.file().getContentType()))
                .contentLength(stored.file().getSizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(new FileSystemResource(stored.path()));
    }

    @PostMapping("/api/v1/files/{fileId}/final")
    public ResponseEntity<TaskFileResponse> markAsFinal(@PathVariable Long fileId, Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(TaskFileResponse.from(taskFileService.markAsFinal(fileId, user)));
    }

    @DeleteMapping("/api/v1/files/{fileId}")
    public ResponseEntity<Void> delete(@PathVariable Long fileId, Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        taskFileService.delete(fileId, user);
        return ResponseEntity.noContent().build();
    }

    private User findAuthenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário autenticado não identificado.");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Usuário autenticado não encontrado."));
    }
}
