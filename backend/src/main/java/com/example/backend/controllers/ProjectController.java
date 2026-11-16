package com.example.backend.controllers;

import com.example.backend.models.Project;
import com.example.backend.dto.ProjectStatusUpdateRequest;
import com.example.backend.dto.ProjectCreateRequest;
import com.example.backend.services.ProjectService;
import com.example.backend.repositories.UserRepository;
import com.example.backend.models.User;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;
import java.util.Optional;

/**
 * Controlador REST para gerenciar endpoints relacionados a projetos (RF005).
 */
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectService projectService;
    private final UserRepository userRepository;

    public ProjectController(ProjectService projectService, UserRepository userRepository) {
        this.projectService = projectService;
        this.userRepository = userRepository;
    }

    /**
     * Endpoint para listar todos os projetos existentes no sistema.
     * GET /api/v1/projects
     * @return ResponseEntity contendo a lista de projetos.
     */
    @GetMapping
    public ResponseEntity<List<Project>> getAllProjects(Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        List<Project> projects = projectService.findProjectsForUser(user);
        return ResponseEntity.ok(projects);
    }

    /**
     * Endpoint para buscar um projeto por seu ID.
     * GET /api/v1/projects/{projectId}
     * @param projectId O ID do projeto a ser buscado.
     * @return ResponseEntity com o projeto ou 404 Not Found.
     */
    @GetMapping("/{projectId}")
    public ResponseEntity<Project> getProjectById(
            @PathVariable Long projectId,
            Authentication authentication
    ) {
        User user = findAuthenticatedUser(authentication);
        // Temporary creator-only policy until project membership is implemented in Etapa B.
        Optional<Project> project = projectService.findProjectByIdForCreator(projectId, user);
        return project.map(ResponseEntity::ok)
                      .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Endpoint para criar um novo projeto. (Assumindo que o usuário autenticado é o criador).
     * POST /api/v1/projects
     * @param projectDetails Campos permitidos para a criação do projeto.
     * @param currentUser O usuário que está realizando a criação.
     * @return ResponseEntity com o projeto criado.
     */
    @PostMapping
    @PreAuthorize("hasRole('ARTIST')")
    public ResponseEntity<Project> createProject(
            @RequestBody ProjectCreateRequest projectDetails,
            Authentication authentication) {
        User creator = findAuthenticatedUser(authentication);
        Project newProject = projectService.createProject(projectDetails.toNewProject(), creator);
        return ResponseEntity.status(201).body(newProject);
    }

    @PatchMapping("/{projectId}/status")
    public ResponseEntity<Project> updateProjectStatus(@PathVariable Long projectId,
                                                        @RequestBody ProjectStatusUpdateRequest request,
                                                        Authentication authentication) {
        User creator = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(projectService.updateStatus(projectId, creator, request.getStatus()));
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<Void> deleteProject(@PathVariable Long projectId, Authentication authentication) {
        User creator = findAuthenticatedUser(authentication);
        projectService.deleteProject(projectId, creator);
        return ResponseEntity.noContent().build();
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
