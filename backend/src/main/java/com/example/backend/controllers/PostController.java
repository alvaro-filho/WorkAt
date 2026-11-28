package com.example.backend.controllers;

import com.example.backend.dto.PostResponse;
import com.example.backend.dto.PostUpdateRequest;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.PostService;
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

    private com.example.backend.services.TaskFileService taskFileService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setTaskFileService(com.example.backend.services.TaskFileService taskFileService) {
        this.taskFileService = taskFileService;
    }

    /** Opcional (testes antigos constroem sem ele): travas de VPN, banimento e registro de acesso. */
    private com.example.backend.services.SecurityGate securityGate;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setSecurityGate(com.example.backend.services.SecurityGate securityGate) {
        this.securityGate = securityGate;
    }

    public PostController(PostService postService, UserRepository userRepository) {
        this.postService = postService;
        this.userRepository = userRepository;
    }

    // O caminho antigo da vitrine continua respondendo: é o health check do Render (render.yaml).
    @GetMapping({"/api/v1/feed", "/api/v1/showcase/public"})
    public List<PostResponse> feed(@RequestParam(required = false) Long before,
                                   @RequestParam(required = false) Integer limit,
                                   Authentication authentication) {
        return postService.feed(before, limit, optionalUser(authentication));
    }

    /** Curtir, republicar ou salvar (PUT liga, DELETE desliga). tipo: like, repost ou save. */
    @org.springframework.web.bind.annotation.PutMapping("/api/v1/posts/{postId}/reactions/{type}")
    public PostResponse react(@PathVariable Long postId, @PathVariable String type, Authentication authentication) {
        return postService.react(postId, requireUser(authentication), reactionType(type), true);
    }

    @DeleteMapping("/api/v1/posts/{postId}/reactions/{type}")
    public PostResponse unreact(@PathVariable Long postId, @PathVariable String type, Authentication authentication) {
        return postService.react(postId, requireUser(authentication), reactionType(type), false);
    }

    private static com.example.backend.models.PostReaction.Type reactionType(String value) {
        return switch (value == null ? "" : value.toLowerCase()) {
            case "like" -> com.example.backend.models.PostReaction.Type.LIKE;
            case "repost" -> com.example.backend.models.PostReaction.Type.REPOST;
            case "save" -> com.example.backend.models.PostReaction.Type.SAVE;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reação inválida (use like, repost ou save).");
        };
    }

    @PostMapping(value = "/api/v1/posts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PostResponse> create(@RequestParam("file") List<MultipartFile> files,
                                               @RequestParam(value = "title", required = false) String title,
                                               @RequestParam(value = "subtitle", required = false) String subtitle,
                                               Authentication authentication) {
        User user = requireUser(authentication);
        if (securityGate != null) securityGate.checkPosting(user, com.example.backend.models.SecurityEvent.Type.POST);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(postService.toResponse(createWithinQuota(user, files, title, subtitle), user));
    }

    @PostMapping("/api/v1/files/{fileId}/post")
    public ResponseEntity<PostResponse> publishTaskFile(@PathVariable Long fileId,
                                                        @RequestBody(required = false) Map<String, String> body,
                                                        Authentication authentication) {
        User user = requireUser(authentication);
        if (securityGate != null) securityGate.checkPosting(user, com.example.backend.models.SecurityEvent.Type.POST);
        Map<String, String> fields = body == null ? Map.of() : body;
        return ResponseEntity.status(HttpStatus.CREATED).body(postService.toResponse(
                postService.publishTaskFile(fileId, user, fields.get("title"), fields.get("subtitle")), user));
    }

    @GetMapping("/api/v1/posts/{postId}")
    public PostResponse get(@PathVariable Long postId, Authentication authentication) {
        // Pública para publicações públicas (página da arte aberta por link); as outras só com login.
        return postService.get(postId, optionalUser(authentication));
    }

    @PatchMapping("/api/v1/posts/{postId}")
    public PostResponse update(@PathVariable Long postId, @RequestBody PostUpdateRequest request,
                               Authentication authentication) {
        User user = requireUser(authentication);
        return postService.toResponse(postService.update(postId, user, request.getTitle(), request.getSubtitle(),
                request.getHiddenFromPortfolio()), user);
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
                .body(image.content());
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

    /** Post avulso também conta na cota de espaço da pessoa. */
    private com.example.backend.models.Post createWithinQuota(User user, List<MultipartFile> files,
                                                              String title, String subtitle) {
        if (taskFileService != null && files != null) {
            taskFileService.ensureQuota(user, files.stream().filter(java.util.Objects::nonNull)
                    .mapToLong(MultipartFile::getSize).sum());
        }
        return postService.createStandalone(user, files, title, subtitle);
    }
}
