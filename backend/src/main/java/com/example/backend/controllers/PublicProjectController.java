package com.example.backend.controllers;

import com.example.backend.dto.PublicProjectResponse;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.PostService;
import com.example.backend.services.PublicProjectService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Visão pública do projeto. A tela exige login (decisão 4); as imagens de projeto público não. */
@RestController
public class PublicProjectController {

    private final PublicProjectService publicProjectService;
    private final UserRepository userRepository;

    public PublicProjectController(PublicProjectService publicProjectService, UserRepository userRepository) {
        this.publicProjectService = publicProjectService;
        this.userRepository = userRepository;
    }

    @GetMapping("/api/v1/projects/{projectId}/public")
    public PublicProjectResponse view(@PathVariable Long projectId,
                                      @RequestParam(required = false, defaultValue = "asc") String order,
                                      Authentication authentication) {
        User user = optionalUser(authentication);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário autenticado não identificado.");
        }
        return publicProjectService.view(projectId, user, order);
    }

    @GetMapping("/api/v1/projects/{projectId}/public/files/{fileId}")
    public ResponseEntity<Resource> image(@PathVariable Long projectId, @PathVariable Long fileId,
                                          Authentication authentication) {
        PostService.ImageContent image = publicProjectService.image(projectId, fileId, optionalUser(authentication));
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
}
