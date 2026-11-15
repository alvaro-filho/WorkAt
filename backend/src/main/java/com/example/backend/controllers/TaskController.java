package com.example.backend.controllers;

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

    @PatchMapping("/api/v1/tasks/{taskId}/status")
    public ResponseEntity<TaskResponse> updateStatus(@PathVariable Long taskId,
                                                     @Valid @RequestBody TaskStatusUpdateRequest request,
                                                     Authentication authentication) {
        User creator = findAuthenticatedUser(authentication);
        Task task = taskService.updateStatus(taskId, creator, request.getStatus());
        return ResponseEntity.ok(TaskResponse.from(task));
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
