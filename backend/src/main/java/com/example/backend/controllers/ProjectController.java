package com.example.backend.controllers;

import com.example.backend.dto.InvitationCreateRequest;
import com.example.backend.dto.InvitationResponse;
import com.example.backend.dto.ProjectCreateRequest;
import com.example.backend.dto.ProjectMemberResponse;
import com.example.backend.dto.ProjectResponse;
import com.example.backend.dto.ProjectSettingsRequest;
import com.example.backend.dto.ProjectStatusUpdateRequest;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.ProjectMembershipService;
import com.example.backend.services.ProjectService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Projetos e participação. Quem não participa do projeto recebe 404; membro sem permissão recebe 403.
 */
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectService projectService;
    private final ProjectMembershipService membershipService;
    private final UserRepository userRepository;

    public ProjectController(ProjectService projectService, ProjectMembershipService membershipService,
                             UserRepository userRepository) {
        this.projectService = projectService;
        this.membershipService = membershipService;
        this.userRepository = userRepository;
    }

    /** GET /api/v1/projects — projetos em que o usuário é dono ou membro. */
    @GetMapping
    public ResponseEntity<List<ProjectResponse>> listMyProjects(Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(projectService.findProjectsForUser(user).stream()
                .map(project -> ProjectResponse.from(project, user)).toList());
    }

    @GetMapping("/{projectId}")
    public ResponseEntity<ProjectResponse> getProject(@PathVariable Long projectId, Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(ProjectResponse.from(projectService.findProjectForParticipant(projectId, user), user));
    }

    /** Qualquer conta (artista ou empresa) pode criar projetos de qualquer tipo. */
    @PostMapping
    public ResponseEntity<ProjectResponse> createProject(@RequestBody ProjectCreateRequest projectDetails,
                                                         Authentication authentication) {
        User creator = findAuthenticatedUser(authentication);
        var created = projectService.createProject(projectDetails.toNewProject(), creator);
        return ResponseEntity.status(HttpStatus.CREATED).body(ProjectResponse.from(created, creator));
    }

    @PatchMapping("/{projectId}/status")
    public ResponseEntity<ProjectResponse> updateProjectStatus(@PathVariable Long projectId,
                                                               @RequestBody ProjectStatusUpdateRequest request,
                                                               Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(ProjectResponse.from(
                projectService.updateStatus(projectId, user, request.getStatus()), user));
    }

    @PatchMapping("/{projectId}/settings")
    public ResponseEntity<ProjectResponse> updateSettings(@PathVariable Long projectId,
                                                          @RequestBody ProjectSettingsRequest request,
                                                          Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(ProjectResponse.from(
                projectService.updateSettings(projectId, user, request.getContractorsSeeAllTasks()), user));
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<Void> deleteProject(@PathVariable Long projectId, Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        projectService.deleteProject(projectId, user);
        return ResponseEntity.noContent().build();
    }

    // ---- Participação ----

    @GetMapping("/{projectId}/members")
    public ResponseEntity<List<ProjectMemberResponse>> listMembers(@PathVariable Long projectId,
                                                                   Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(membershipService.listMembers(projectId, user).stream()
                .map(ProjectMemberResponse::from).toList());
    }

    @DeleteMapping("/{projectId}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long projectId, @PathVariable Long userId,
                                             Authentication authentication) {
        User owner = findAuthenticatedUser(authentication);
        membershipService.removeMember(projectId, userId, owner);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{projectId}/leave")
    public ResponseEntity<Void> leave(@PathVariable Long projectId, Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        membershipService.leave(projectId, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{projectId}/invitations")
    public ResponseEntity<InvitationResponse> invite(@PathVariable Long projectId,
                                                     @Valid @RequestBody InvitationCreateRequest request,
                                                     Authentication authentication) {
        User owner = findAuthenticatedUser(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(InvitationResponse.from(membershipService.invite(projectId, owner, request.getEmail())));
    }

    @GetMapping("/{projectId}/invitations")
    public ResponseEntity<List<InvitationResponse>> pendingInvitations(@PathVariable Long projectId,
                                                                       Authentication authentication) {
        User owner = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(membershipService.pendingForProject(projectId, owner).stream()
                .map(InvitationResponse::from).toList());
    }

    private User findAuthenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário autenticado não identificado.");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Usuário autenticado não encontrado."
                ));
    }
}
