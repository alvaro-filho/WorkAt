package com.example.backend.controllers;

import com.example.backend.dto.PostResponse;
import com.example.backend.dto.PostUpdateRequest;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.PostService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Publicações: feed, post avulso, "Publicar como post" a partir de uma imagem de tarefa, edição e imagens.
 * O feed e as imagens de publicações públicas não exigem login; o resto exige.
 */
@RestController
public class PostController {

    private final PostService postService;
    private final UserRepository userRepository;

    public PostController(PostService postService, UserRepository userRepository) {
        this.postService = postService;
        this.userRepository = userRepository;
    }

    // O caminho antigo da vitrine continua respondendo: é o health check do Render (render.yaml).
    @GetMapping({"/api/v1/feed", "/api/v1/showcase/public"})
    public List<PostResponse> feed(@RequestParam(required = false) Long before,
                                   @RequestParam(required = false) Integer limit) {
        return postService.feed(before, limit);
    }

    @PostMapping(value = "/api/v1/posts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PostResponse> create(@RequestParam("file") MultipartFile file,
                                               @RequestParam(value = "title", required = false) String title,
                                               @RequestParam(value = "subtitle", required = false) String subtitle,
                                               Authentication authentication) {
        User user = requireUser(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(postService.toResponse(postService.createStandalone(user, file, title, subtitle)));
    }

    @PostMapping("/api/v1/files/{fileId}/post")
    public ResponseEntity<PostResponse> publishTaskFile(@PathVariable Long fileId,
                                                        @RequestBody(required = false) Map<String, String> body,
                                                        Authentication authentication) {
        User user = requireUser(authentication);
        Map<String, String> fields = body == null ? Map.of() : body;
        return ResponseEntity.status(HttpStatus.CREATED).body(postService.toResponse(
                postService.publishTaskFile(fileId, user, fields.get("title"), fields.get("subtitle"))));
    }

    @GetMapping("/api/v1/posts/{postId}")
    public PostResponse get(@PathVariable Long postId, Authentication authentication) {
        return postService.get(postId, requireUser(authentication));
    }

    @PatchMapping("/api/v1/posts/{postId}")
    public PostResponse update(@PathVariable Long postId, @RequestBody PostUpdateRequest request,
                               Authentication authentication) {
        User user = requireUser(authentication);
        return postService.toResponse(postService.update(postId, user, request.getTitle(), request.getSubtitle(),
                request.getHiddenFromPortfolio()));
    }

    @DeleteMapping("/api/v1/posts/{postId}")
    public ResponseEntity<Void> delete(@PathVariable Long postId, Authentication authentication) {
        postService.delete(postId, requireUser(authentication));
        return ResponseEntity.noContent().build();
    }

    /** Pública para publicações públicas; as outras só com login do autor ou de quem participa do projeto. */
    @GetMapping("/api/v1/posts/{postId}/images/{imageId}")
    public ResponseEntity<Resource> image(@PathVariable Long postId, @PathVariable Long imageId,
                                          Authentication authentication) {
        PostService.ImageContent image = postService.image(postId, imageId, optionalUser(authentication));
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
