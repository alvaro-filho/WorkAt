package com.example.backend.services;

import com.example.backend.dto.TaskCreateRequest;
import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.TaskStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class TaskService {

    private final ProjectAccessService access;
    private final TaskRepository taskRepository;

    public TaskService(ProjectAccessService access, TaskRepository taskRepository) {
        this.access = access;
        this.taskRepository = taskRepository;
    }

    @Transactional
    public Task createTask(Long projectId, User user, TaskCreateRequest request) {
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O título é obrigatório.");
        }
        if (request.getPriority() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A prioridade deve ser LOW, MEDIUM ou HIGH.");
        }

        Project project = access.requireParticipant(projectId, user);
        access.ensureCanManageTasks(project, user);
        access.ensureActive(project);

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
    public List<Task> listTasks(Long projectId, User user) {
        Project project = access.requireParticipant(projectId, user);
        return taskRepository.findByProjectOrderByCreatedAtAsc(project);
    }

    @Transactional
    public Task updateStatus(Long taskId, User user, TaskStatus status) {
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O status é obrigatório.");
        }
        Task task = findTaskForParticipant(taskId, user);
        access.ensureCanMoveTasks(task.getProject(), user);
        access.ensureActive(task.getProject());
        task.setStatus(status);
        return taskRepository.save(task);
    }

    @Transactional
    public void deleteTask(Long taskId, User user) {
        Task task = findTaskForParticipant(taskId, user);
        access.ensureCanManageTasks(task.getProject(), user);
        access.ensureActive(task.getProject());
        taskRepository.delete(task);
    }

    private Task findTaskForParticipant(Long taskId, User user) {
        return taskRepository.findById(taskId)
                .filter(task -> access.roleOf(task.getProject(), user).isPresent())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarefa não encontrada."));
    }
}
