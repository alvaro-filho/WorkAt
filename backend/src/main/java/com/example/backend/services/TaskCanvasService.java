package com.example.backend.services;

import com.example.backend.dto.TaskCanvasDto;
import com.example.backend.models.Task;
import com.example.backend.models.TaskCanvas;
import com.example.backend.models.User;
import com.example.backend.repositories.TaskCanvasRepository;
import com.example.backend.repositories.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Canvas por tarefa. Quem vê a tarefa vê o Canvas; quem trabalha nela (mesma regra de mover e enviar arquivos) edita.
 * Tempo real (WebSockets) e Canvas global do projeto ficam como trabalho futuro.
 */
@Service
public class TaskCanvasService {

    /** Cerca de 15 MB de texto: cabem dezenas de referências reduzidas no navegador. */
    static final int MAX_CONTENT_CHARS = 15_000_000;

    private final ProjectAccessService access;
    private final TaskRepository taskRepository;
    private final TaskCanvasRepository canvasRepository;

    public TaskCanvasService(ProjectAccessService access, TaskRepository taskRepository,
                             TaskCanvasRepository canvasRepository) {
        this.access = access;
        this.taskRepository = taskRepository;
        this.canvasRepository = canvasRepository;
    }

    @Transactional(readOnly = true)
    public TaskCanvasDto get(Long taskId, User user) {
        Task task = findVisibleTask(taskId, user);
        return canvasRepository.findByTask(task)
                .map(TaskCanvasService::toDto)
                .orElse(new TaskCanvasDto("[]", null, null));
    }

    @Transactional
    public TaskCanvasDto save(Long taskId, User user, String content) {
        Task task = findVisibleTask(taskId, user);
        access.ensureCanWorkOnTask(task, user);
        access.ensureActive(task.getProject());
        if (content == null || content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O conteúdo do Canvas é obrigatório.");
        }
        String trimmed = content.trim();
        if (!trimmed.startsWith("[")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato de Canvas inválido.");
        }
        if (trimmed.length() > MAX_CONTENT_CHARS) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "O Canvas ficou grande demais. Remova algumas imagens ou use imagens menores.");
        }
        TaskCanvas canvas = canvasRepository.findByTask(task).orElseGet(() -> {
            TaskCanvas created = new TaskCanvas();
            created.setTask(task);
            return created;
        });
        canvas.setContent(trimmed);
        canvas.setUpdatedBy(user);
        return toDto(canvasRepository.save(canvas));
    }

    private Task findVisibleTask(Long taskId, User user) {
        return taskRepository.findById(taskId)
                .filter(task -> access.canSeeTask(task, user))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarefa não encontrada."));
    }

    private static TaskCanvasDto toDto(TaskCanvas canvas) {
        return new TaskCanvasDto(canvas.getContent(),
                canvas.getUpdatedBy() == null ? null : canvas.getUpdatedBy().getFullName(),
                canvas.getUpdatedAt());
    }
}
