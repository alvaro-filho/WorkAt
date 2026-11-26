package com.example.backend.controllers;

import com.example.backend.dto.ProfileResponse;
import com.example.backend.models.User;
import com.example.backend.services.AccountService;
import com.example.backend.services.CurrentUser;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Minha conta: perfil, foto, senha, exportar e excluir. E o pedido de nova senha (sem login). */
@RestController
public class AccountController {

    private final AccountService accounts;
    private final CurrentUser currentUser;

    public AccountController(AccountService accounts, CurrentUser currentUser) {
        this.accounts = accounts;
        this.currentUser = currentUser;
    }

    public record AccountResponse(Long id, String fullName, String username, String email, String role,
                                  String avatarUrl, String bio, List<String> specialties, List<String> links,
                                  LocalDateTime createdAt, long storageUsedBytes, long storageQuotaBytes) {
    }

    public record ProfileUpdate(String fullName, String bio, List<String> specialties, List<String> links) {
    }

    public record PasswordChange(String currentPassword, String newPassword) {
    }

    public record ForgotPassword(String email) {
    }

    public record ResetPassword(String token, String newPassword) {
    }

    public record DeleteAccount(String password) {
    }

    private AccountResponse response(User user) {
        return new AccountResponse(user.getId(), user.getFullName(), user.getUsername(), user.getEmail(),
                user.getRole().name(), user.avatarUrl(), user.getBio(),
                ProfileResponse.split(user.getSpecialties(), ","), ProfileResponse.split(user.getLinks(), "\n"),
                user.getCreatedAt(), accounts.usedBytes(user), accounts.quotaBytes());
    }

    @GetMapping("/api/v1/me")
    public AccountResponse me(Authentication authentication) {
        return response(currentUser.require(authentication));
    }

    @PatchMapping("/api/v1/me/profile")
    public AccountResponse updateProfile(@RequestBody ProfileUpdate request, Authentication authentication) {
        User user = currentUser.require(authentication);
        ProfileUpdate body = request == null ? new ProfileUpdate(null, null, null, null) : request;
        return response(accounts.updateProfile(user, body.fullName(), body.bio(), body.specialties(), body.links()));
    }

    @PostMapping(value = "/api/v1/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AccountResponse uploadAvatar(@RequestParam("file") MultipartFile file, Authentication authentication) {
        return response(accounts.uploadAvatar(currentUser.require(authentication), file));
    }

    @DeleteMapping("/api/v1/me/avatar")
    public AccountResponse removeAvatar(Authentication authentication) {
        return response(accounts.removeAvatar(currentUser.require(authentication)));
    }

    /** Foto pública (aparece no perfil, no feed e nos quadros). */
    @GetMapping("/api/v1/users/{username}/avatar")
    public ResponseEntity<Resource> avatar(@PathVariable String username) {
        AccountService.Avatar avatar = accounts.avatar(username);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(avatar.contentType()))
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .body(avatar.content());
    }

    @PostMapping("/api/v1/me/password")
    public ResponseEntity<Map<String, String>> changePassword(@RequestBody PasswordChange request,
                                                              Authentication authentication) {
        accounts.changePassword(currentUser.require(authentication),
                request == null ? null : request.currentPassword(), request == null ? null : request.newPassword());
        return ResponseEntity.ok(Map.of("message", "Senha alterada."));
    }

    @PostMapping("/api/v1/auth/forgot-password")
    public Map<String, String> forgot(@RequestBody ForgotPassword request) {
        accounts.requestPasswordReset(request == null ? null : request.email());
        return Map.of("message", "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha.");
    }

    @PostMapping("/api/v1/auth/reset-password")
    public Map<String, String> reset(@RequestBody ResetPassword request) {
        accounts.resetPassword(request == null ? null : request.token(), request == null ? null : request.newPassword());
        return Map.of("message", "Senha alterada. Entre com a nova senha.");
    }

    @GetMapping("/api/v1/me/export")
    public ResponseEntity<Map<String, Object>> export(Authentication authentication) {
        User user = currentUser.require(authentication);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("workat-" + user.getUsername() + "-dados.json", StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(accounts.export(user));
    }

    @PostMapping("/api/v1/me/delete")
    public ResponseEntity<Void> delete(@RequestBody DeleteAccount request, Authentication authentication) {
        accounts.deleteAccount(currentUser.require(authentication), request == null ? null : request.password());
        return ResponseEntity.noContent().build();
    }
}
