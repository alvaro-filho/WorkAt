package com.example.backend.controllers;

import com.example.backend.dto.AdminDtos.ActionRow;
import com.example.backend.dto.AdminDtos.BanRequest;
import com.example.backend.dto.AdminDtos.Overview;
import com.example.backend.dto.AdminDtos.ReasonRequest;
import com.example.backend.dto.AdminDtos.SuspendRequest;
import com.example.backend.dto.AdminDtos.UpdateRequest;
import com.example.backend.dto.AdminDtos.UserDetail;
import com.example.backend.dto.AdminDtos.UserRow;
import com.example.backend.models.User;
import com.example.backend.services.AdminService;
import com.example.backend.services.CurrentUser;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Painel de administração. Toda rota confere se quem pede está em ARTHUB_ADMIN_EMAILS; para os outros
 * (com ou sem login) a resposta é "não encontrado", como se o painel não existisse.
 */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final AdminService admin;
    private final com.example.backend.services.ModerationService moderation;
    private final CurrentUser currentUser;

    public AdminController(AdminService admin, com.example.backend.services.ModerationService moderation,
                           CurrentUser currentUser) {
        this.admin = admin;
        this.moderation = moderation;
        this.currentUser = currentUser;
    }

    private User who(Authentication authentication) {
        User user = currentUser.optional(authentication);
        admin.requireAdmin(user);
        return user;
    }

    @GetMapping("/overview")
    public Overview overview(Authentication authentication) {
        return admin.overview(who(authentication));
    }

    @GetMapping("/users")
    public List<UserRow> users(@RequestParam(required = false) String q,
                               @RequestParam(required = false) String status,
                               @RequestParam(required = false) String role,
                               @RequestParam(required = false) String sort,
                               Authentication authentication) {
        return admin.users(who(authentication), q, status, role, sort);
    }

    @GetMapping("/users/{id}")
    public UserDetail user(@PathVariable Long id, Authentication authentication) {
        return admin.user(who(authentication), id);
    }

    @PostMapping("/users/{id}/suspend")
    public UserDetail suspend(@PathVariable Long id, @RequestBody(required = false) SuspendRequest request,
                              Authentication authentication) {
        return admin.suspend(who(authentication), id, request == null ? null : request.days(),
                request == null ? null : request.reason());
    }

    @PostMapping("/users/{id}/reactivate")
    public UserDetail reactivate(@PathVariable Long id, @RequestBody(required = false) ReasonRequest request,
                                 Authentication authentication) {
        return admin.reactivate(who(authentication), id, request == null ? null : request.reason());
    }

    @PostMapping("/users/{id}/ban")
    public UserDetail ban(@PathVariable Long id, @RequestBody(required = false) BanRequest request,
                          Authentication authentication) {
        User user = who(authentication);
        moderation.ban(user, id, request == null ? null : request.reason(), request == null ? null : request.password());
        return admin.user(user, id);
    }

    /** Conta banida: apaga o conteúdo para liberar espaço (pede a senha; congela mais uma prova antes). */
    @PostMapping("/users/{id}/purge")
    public UserDetail purge(@PathVariable Long id, @RequestBody(required = false) BanRequest request,
                            Authentication authentication) {
        User user = who(authentication);
        moderation.purgeContent(user, id, request == null ? null : request.password());
        return admin.user(user, id);
    }

    @PostMapping("/users/{id}/trust")
    public UserDetail trust(@PathVariable Long id, Authentication authentication) {
        User user = who(authentication);
        moderation.trust(user, id);
        return admin.user(user, id);
    }

    /** Dossiê em ZIP (images=true inclui as imagens que ainda existirem). */
    @GetMapping("/users/{id}/dossier")
    public org.springframework.http.ResponseEntity<byte[]> dossier(@PathVariable Long id,
                                                                   @RequestParam(defaultValue = "false") boolean images,
                                                                   Authentication authentication) {
        byte[] zip = moderation.dossier(who(authentication), id, images);
        String name = "dossie-conta-" + id + "-" + java.time.LocalDate.now() + ".zip";
        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(org.springframework.http.MediaType.parseMediaType("application/zip"))
                .body(zip);
    }

    /** Fila de aprovação das publicações de contas novas. */
    @GetMapping("/review")
    public List<com.example.backend.dto.PostResponse> review(Authentication authentication) {
        return moderation.queue(who(authentication));
    }

    @PostMapping("/posts/{postId}/approve")
    public org.springframework.http.ResponseEntity<Void> approve(@PathVariable Long postId, Authentication authentication) {
        moderation.approvePost(who(authentication), postId);
        return org.springframework.http.ResponseEntity.noContent().build();
    }

    /** Remove a publicação e avisa o autor de que ela quebrou as diretrizes (também serve para recusar na fila). */
    @PostMapping("/posts/{postId}/remove")
    public org.springframework.http.ResponseEntity<Void> removePost(@PathVariable Long postId,
                                                                    @RequestBody(required = false) ReasonRequest request,
                                                                    Authentication authentication) {
        moderation.removePost(who(authentication), postId, request == null ? null : request.reason());
        return org.springframework.http.ResponseEntity.noContent().build();
    }

    /** Para conferir em produção de onde o servidor acha que você está vindo (IP e cabeçalhos do proxy). */
    @GetMapping("/whoami")
    public java.util.Map<String, Object> whoami(Authentication authentication, jakarta.servlet.http.HttpServletRequest request) {
        who(authentication);
        var info = com.example.backend.services.ClientContext.of(request);
        java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("ip", info.ip());
        out.put("xForwardedFor", info.forwardedChain());
        out.put("remoteAddr", request.getRemoteAddr());
        java.util.Map<String, String> related = new java.util.TreeMap<>();
        java.util.Collections.list(request.getHeaderNames()).forEach(name -> {
            String lower = name.toLowerCase(java.util.Locale.ROOT);
            if (lower.contains("forward") || lower.contains("ip") || lower.startsWith("x-vercel") || lower.startsWith("cf-")
                    || lower.startsWith("x-render") || lower.equals("via")) {
                related.put(lower, request.getHeader(name));
            }
        });
        out.put("cabecalhos", related);
        out.put("deviceId", info.deviceId());
        return out;
    }

    @PatchMapping("/users/{id}")
    public UserDetail update(@PathVariable Long id, @RequestBody(required = false) UpdateRequest request,
                             Authentication authentication) {
        return admin.update(who(authentication), id, request == null ? null : request.quotaMb(),
                request == null ? null : request.note());
    }

    @GetMapping("/log")
    public List<ActionRow> log(@RequestParam(defaultValue = "200") int limit, Authentication authentication) {
        return admin.log(who(authentication), limit);
    }
}
