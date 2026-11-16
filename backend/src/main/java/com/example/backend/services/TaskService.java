package com.example.backend.services;

import com.example.backend.dto.TaskCreateRequest;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.Task;
import com.example.backend.models.TaskStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class TaskService {
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;

    public TaskService(ProjectRepository projectRepository, TaskRepository taskRepository) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
    }

    @Transactional
    public Task createTask(Long projectId, User creator, TaskCreateRequest request) {
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O título é obrigatório.");
        }
        if (request.getPriority() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A prioridade deve ser LOW, MEDIUM ou HIGH.");
        }
        Project project = projectRepository.findByIdAndCreatedByUser(projectId, creator)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado."));
        ensureProjectIsActive(project);

        Task task = new Task();
        task.setTitle(request.getTitle().trim());
        task.setDescription(request.getDescription());
        task.setPriority(request.getPriority());
        task.setDeadline(request.getDeadline());
        task.setStatus(TaskStatus.TODO);
        task.setProject(project);
        return taskRepository.save(task);
    }

    @Transactional(readOnly = true)
    public List<Task> listTasks(Long projectId, User creator) {
        Project project = projectRepository.findByIdAndCreatedByUser(projectId, creator)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado."));
        return taskRepository.findByProjectOrderByCreatedAtAsc(project);
    }

    @Transactional
    public Task updateStatus(Long taskId, User creator, TaskStatus status) {
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O status é obrigatório.");
        }
        Task task = taskRepository.findByIdAndProject_CreatedByUser(taskId, creator)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarefa não encontrada."));
        ensureProjectIsActive(task.getProject());
        task.setStatus(status);
        return taskRepository.save(task);
    }

    @Transactional
    public void deleteTask(Long taskId, User creator) {
        Task task = taskRepository.findByIdAndProject_CreatedByUser(taskId, creator)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarefa não encontrada."));
        ensureProjectIsActive(task.getProject());
        taskRepository.delete(task);
    }

    private void ensureProjectIsActive(Project project) {
        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Projeto encerrado. Retome o projeto para alterar tarefas.");
        }
    }
}
