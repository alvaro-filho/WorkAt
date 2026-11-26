package com.example.backend.controllers;

import com.example.backend.dto.ProjectResponse;
import com.example.backend.dto.UserSummary;
import com.example.backend.models.ProjectHistory;
import com.example.backend.models.User;
import com.example.backend.services.CurrentUser;
import com.example.backend.services.ProjectExtrasService;
import com.example.backend.services.ProjectMembershipService;
import com.example.backend.services.ProjectService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

/** Histórico, transferência de posse, cancelar convite, modelos e o .zip das finais. */
@RestController
public class ProjectExtrasController {

    private final ProjectExtrasService extras;
    private final ProjectService projectService;
    private final ProjectMembershipService membershipService;
    private final CurrentUser currentUser;

    public ProjectExtrasController(ProjectExtrasService extras, ProjectService projectService,
                                   ProjectMembershipService membershipService, CurrentUser currentUser) {
        this.extras = extras;
        this.projectService = projectService;
        this.membershipService = membershipService;
        this.currentUser = currentUser;
    }

    public record HistoryResponse(Long id, String type, String message, UserSummary actor, Long taskId,
                                  LocalDateTime createdAt) {
        static HistoryResponse from(ProjectHistory h) {
            return new HistoryResponse(h.getId(), h.getType(), h.getMessage(), UserSummary.from(h.getActor()),
                    h.getTaskId(), h.getCreatedAt());
        }
    }

    public record TransferRequest(Long userId) {
    }

    @GetMapping("/api/v1/projects/{projectId}/history")
    public List<HistoryResponse> history(@PathVariable Long projectId, Authentication authentication) {
        return extras.history(projectId, currentUser.require(authentication)).stream()
                .map(HistoryResponse::from).toList();
    }

    @PostMapping("/api/v1/projects/{projectId}/transfer")
    public ProjectResponse transfer(@PathVariable Long projectId, @RequestBody TransferRequest request,
                                    Authentication authentication) {
        User user = currentUser.require(authentication);
        var project = projectService.transferOwnership(projectId, user, request == null ? null : request.userId());
        return ProjectResponse.from(project, user);
    }

    @DeleteMapping("/api/v1/projects/{projectId}/invitations/{invitationId}")
    public ResponseEntity<Void> cancelInvitation(@PathVariable Long projectId, @PathVariable Long invitationId,
                                                 Authentication authentication) {
        membershipService.cancelInvitation(projectId, invitationId, currentUser.require(authentication));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/v1/project-templates")
    public List<ProjectExtrasService.ProjectTemplate> templates() {
        return ProjectExtrasService.TEMPLATES;
    }

    @GetMapping("/api/v1/projects/{projectId}/finals.zip")
    public ResponseEntity<StreamingResponseBody> finals(@PathVariable Long projectId, Authentication authentication) {
        var archive = extras.finals(projectId, currentUser.require(authentication));
        StreamingResponseBody body = out -> extras.writeZip(archive, out);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(archive.fileName(), StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(body);
    }
}
