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
    private final TaskFileService taskFileService;

    public TaskService(ProjectAccessService access, TaskRepository taskRepository, TaskFileService taskFileService) {
        this.access = access;
        this.taskRepository = taskRepository;
        this.taskFileService = taskFileService;
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
        if (request.getAssigneeId() != null) {
            task.setAssignee(access.requireParticipantUser(project, request.getAssigneeId()));
        }
        return taskRepository.save(task);
    }

    /** Tarefas que o usuário pode ver (no corporativo, o contratado só vê as dele, salvo liberação do dono). */
    @Transactional(readOnly = true)
    public List<Task> listTasks(Long projectId, User user) {
        Project project = access.requireParticipant(projectId, user);
        return taskRepository.findByProjectOrderByCreatedAtAsc(project).stream()
                .filter(task -> access.canSeeTask(task, user))
                .toList();
    }

    @Transactional(readOnly = true)
    public Task getTask(Long taskId, User user) {
        return findVisibleTask(taskId, user);
    }

    @Transactional
    public Task updateStatus(Long taskId, User user, TaskStatus status) {
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O status é obrigatório.");
        }
        Task task = findVisibleTask(taskId, user);
        access.ensureCanWorkOnTask(task, user);
        access.ensureActive(task.getProject());
        task.setStatus(status);
        return taskRepository.save(task);
    }

    /** Define ou remove (userId nulo) o responsável. Quem pode criar tarefas pode atribuir. */
    @Transactional
    public Task assign(Long taskId, User user, Long assigneeId) {
        Task task = findVisibleTask(taskId, user);
        access.ensureCanManageTasks(task.getProject(), user);
        access.ensureActive(task.getProject());
        task.setAssignee(assigneeId == null ? null : access.requireParticipantUser(task.getProject(), assigneeId));
        return taskRepository.save(task);
    }

    @Transactional
    public void deleteTask(Long taskId, User user) {
        Task task = findVisibleTask(taskId, user);
        access.ensureCanManageTasks(task.getProject(), user);
        access.ensureActive(task.getProject());
        taskFileService.deleteAllForTask(task);
        taskRepository.delete(task);
    }

    private Task findVisibleTask(Long taskId, User user) {
        return taskRepository.findById(taskId)
                .filter(task -> access.canSeeTask(task, user))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarefa não encontrada."));
    }
}
