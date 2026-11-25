package com.example.backend.controllers;

import com.example.backend.dto.ShowcaseResponse;
import com.example.backend.dto.ShowcaseSubmitRequest;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.ShowcaseSubmissionService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
public class ShowcaseSubmissionController {

    private final ShowcaseSubmissionService submissionService;
    private final UserRepository userRepository;

    public ShowcaseSubmissionController(ShowcaseSubmissionService submissionService, UserRepository userRepository) {
        this.submissionService = submissionService;
        this.userRepository = userRepository;
    }

    @PostMapping("/api/v1/tasks/{taskId}/showcase")
    public ResponseEntity<ShowcaseResponse> submit(@PathVariable Long taskId,
                                                   @RequestBody(required = false) ShowcaseSubmitRequest request,
                                                   Authentication authentication) {
        User user = requireUser(authentication);
        ShowcaseSubmitRequest body = request == null ? new ShowcaseSubmitRequest() : request;
        return ResponseEntity.status(HttpStatus.CREATED).body(ShowcaseResponse.from(
                submissionService.submitFromTask(taskId, user, body.getTitle(), body.getDescription())));
    }

    @GetMapping("/api/v1/tasks/{taskId}/showcase")
    public ResponseEntity<ShowcaseResponse> forTask(@PathVariable Long taskId, Authentication authentication) {
        User user = requireUser(authentication);
        return submissionService.forTask(taskId, user)
                .map(art -> ResponseEntity.ok(ShowcaseResponse.from(art)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/api/v1/projects/{projectId}/showcase")
    public List<ShowcaseResponse> forProject(@PathVariable Long projectId, Authentication authentication) {
        User user = requireUser(authentication);
        return submissionService.forProject(projectId, user).stream().map(ShowcaseResponse::from).toList();
    }

    /** Pública para artes liberadas; travadas só com login do artista ou da parte contratante. */
    @GetMapping("/api/v1/showcase/{artId}/image")
    public ResponseEntity<Resource> image(@PathVariable Long artId, Authentication authentication) {
        User viewer = optionalUser(authentication);
        ShowcaseSubmissionService.ImageContent image = submissionService.image(artId, viewer);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .contentLength(image.sizeBytes())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, image.isPublic() ? "public, max-age=300" : "private, no-store")
                .body(new FileSystemResource(image.path()));
    }

    private User optionalUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            return null;
        }
        return userRepository.findByEmail(authentication.getName()).orElse(null);
    }

    private User requireUser(Authentication authentication) {
        User user = optionalUser(authentication);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário autenticado não identificado.");
        }
        return user;
    }
}
