package com.example.backend.controllers;

import com.example.backend.dto.TaskAssigneeRequest;
import com.example.backend.dto.TaskCreateRequest;
import com.example.backend.dto.TaskResponse;
import com.example.backend.dto.TaskStatusUpdateRequest;
import com.example.backend.models.Task;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
public class TaskController {
    private final TaskService taskService;
    private final UserRepository userRepository;

    public TaskController(TaskService taskService, UserRepository userRepository) {
        this.taskService = taskService;
        this.userRepository = userRepository;
    }

    @PostMapping("/api/v1/projects/{projectId}/tasks")
    public ResponseEntity<TaskResponse> createTask(@PathVariable Long projectId,
                                                   @Valid @RequestBody TaskCreateRequest request,
                                                   Authentication authentication) {
        User creator = findAuthenticatedUser(authentication);
        Task task = taskService.createTask(projectId, creator, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(TaskResponse.from(task));
    }

    @GetMapping("/api/v1/projects/{projectId}/tasks")
    public ResponseEntity<List<TaskResponse>> listTasks(@PathVariable Long projectId,
                                                        Authentication authentication) {
        User creator = findAuthenticatedUser(authentication);
        List<TaskResponse> response = taskService.listTasks(projectId, creator).stream()
                .map(TaskResponse::from).toList();
        return ResponseEntity.ok(response);
    }

    /** Minhas tarefas: abertas, atribuídas a mim, em todos os projetos ativos. */
    @GetMapping("/api/v1/me/tasks")
    public List<TaskResponse> myTasks(Authentication authentication) {
        return taskService.myOpenTasks(findAuthenticatedUser(authentication)).stream().map(TaskResponse::from).toList();
    }

    public record ReviewRequest(TaskService.ReviewDecision decision, String note) {
    }

    /** Revisão do dono: APPROVE conclui; REQUEST_CHANGES devolve para Em Progresso com o motivo. */
    @PostMapping("/api/v1/tasks/{taskId}/review")
    public TaskResponse review(@PathVariable Long taskId, @RequestBody ReviewRequest request,
                               Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return TaskResponse.from(taskService.review(taskId, user,
                request == null ? null : request.decision(), request == null ? null : request.note()));
    }

    @GetMapping("/api/v1/tasks/{taskId}")
    public ResponseEntity<TaskResponse> getTask(@PathVariable Long taskId, Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(TaskResponse.from(taskService.getTask(taskId, user)));
    }

    @PatchMapping("/api/v1/tasks/{taskId}/assignee")
    public ResponseEntity<TaskResponse> assign(@PathVariable Long taskId,
                                               @RequestBody TaskAssigneeRequest request,
                                               Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(TaskResponse.from(taskService.assign(taskId, user, request.getUserId())));
    }

    @PatchMapping("/api/v1/tasks/{taskId}/visibility")
    public ResponseEntity<TaskResponse> updateVisibility(@PathVariable Long taskId,
                                                         @RequestBody java.util.Map<String, Boolean> request,
                                                         Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        Boolean hidden = request == null ? null : request.get("hiddenFromPublic");
        if (hidden == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Informe hiddenFromPublic.");
        }
        return ResponseEntity.ok(TaskResponse.from(taskService.setHiddenFromPublic(taskId, user, hidden)));
    }

    @PatchMapping("/api/v1/tasks/{taskId}/status")
    public ResponseEntity<TaskResponse> updateStatus(@PathVariable Long taskId,
                                                     @Valid @RequestBody TaskStatusUpdateRequest request,
                                                     Authentication authentication) {
        User creator = findAuthenticatedUser(authentication);
        Task task = taskService.updateStatus(taskId, creator, request.getStatus());
        return ResponseEntity.ok(TaskResponse.from(task));
    }

    @DeleteMapping("/api/v1/tasks/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long taskId, Authentication authentication) {
        User creator = findAuthenticatedUser(authentication);
        taskService.deleteTask(taskId, creator);
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
