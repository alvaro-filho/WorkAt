package com.example.backend.controllers;

import com.example.backend.dto.TaskCanvasDto;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.TaskCanvasService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class TaskCanvasController {

    private final TaskCanvasService canvasService;
    private final UserRepository userRepository;

    public TaskCanvasController(TaskCanvasService canvasService, UserRepository userRepository) {
        this.canvasService = canvasService;
        this.userRepository = userRepository;
    }

    @GetMapping("/api/v1/tasks/{taskId}/canvas")
    public TaskCanvasDto get(@PathVariable Long taskId, Authentication authentication) {
        return canvasService.get(taskId, user(authentication));
    }

    @PutMapping("/api/v1/tasks/{taskId}/canvas")
    public TaskCanvasDto save(@PathVariable Long taskId, @RequestBody TaskCanvasDto request,
                              Authentication authentication) {
        return canvasService.save(taskId, user(authentication), request.content());
    }

    private User user(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário autenticado não identificado.");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Usuário autenticado não encontrado."));
    }
}
