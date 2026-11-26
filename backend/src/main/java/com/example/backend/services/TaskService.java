package com.example.backend.services;

import com.example.backend.dto.TaskCreateRequest;
import com.example.backend.events.WorkEvent;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectType;
import com.example.backend.models.Task;
import com.example.backend.models.TaskStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class TaskService {

    private final ProjectAccessService access;
    private final TaskRepository taskRepository;
    private final TaskFileService taskFileService;

    private ApplicationEventPublisher events;
    private TaskCommentService comments;

    public static final Map<TaskStatus, String> STATUS_LABEL = Map.of(
            TaskStatus.TODO, "A Fazer", TaskStatus.IN_PROGRESS, "Em Progresso",
            TaskStatus.REVIEW, "Em Revisão", TaskStatus.DONE, "Concluído");

    public enum ReviewDecision { APPROVE, REQUEST_CHANGES }

    public TaskService(ProjectAccessService access, TaskRepository taskRepository, TaskFileService taskFileService) {
        this.access = access;
        this.taskRepository = taskRepository;
        this.taskFileService = taskFileService;
    }

    @Autowired(required = false)
    public void setEvents(ApplicationEventPublisher events) {
        this.events = events;
    }

    @Autowired(required = false)
    public void setComments(TaskCommentService comments) {
        this.comments = comments;
    }

    private void publish(WorkEvent.Type type, Task task, User actor, User target, String detail) {
        if (events != null) {
            events.publishEvent(WorkEvent.of(type, task.getProject(), task, actor, target, detail));
        }
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
        Task saved = taskRepository.save(task);
        publish(WorkEvent.Type.TASK_CREATED, saved, user, null, null);
        if (saved.getAssignee() != null) {
            publish(WorkEvent.Type.TASK_ASSIGNED, saved, user, saved.getAssignee(), null);
        }
        return saved;
    }

    /** Tarefas abertas atribuídas ao usuário, em todos os projetos ativos. */
    @Transactional(readOnly = true)
    public List<Task> myOpenTasks(User user) {
        return taskRepository.findOpenAssignedTo(user);
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
        Project project = task.getProject();
        boolean owner = ProjectAccessService.isOwner(project, user);
        if (project.getType() == ProjectType.CORPORATE && !owner) {
            if (status == TaskStatus.DONE) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Envie para Em Revisão: no corporativo, quem conclui é o dono, ao aprovar.");
            }
            if (task.getStatus() == TaskStatus.DONE) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Tarefa aprovada: só o dono do projeto pode reabrir.");
            }
        }
        if (task.getStatus() == status) {
            return task;
        }
        task.setStatus(status);
        Task saved = taskRepository.save(task);
        if (status == TaskStatus.REVIEW) {
            publish(WorkEvent.Type.REVIEW_REQUESTED, saved, user, null, null);
        } else {
            publish(WorkEvent.Type.TASK_STATUS, saved, user, null, STATUS_LABEL.get(status));
        }
        return saved;
    }

    /**
     * Revisão pelo dono: aprovar conclui a tarefa; pedir ajuste devolve para Em Progresso com o motivo,
     * que fica registrado na conversa da tarefa e avisa o responsável.
     */
    @Transactional
    public Task review(Long taskId, User user, ReviewDecision decision, String note) {
        if (decision == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escolha aprovar ou pedir ajuste.");
        }
        Task task = findVisibleTask(taskId, user);
        if (!ProjectAccessService.isOwner(task.getProject(), user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só o dono do projeto revisa as tarefas.");
        }
        access.ensureActive(task.getProject());
        if (task.getStatus() != TaskStatus.REVIEW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A tarefa não está em revisão.");
        }
        String text = note == null ? "" : note.trim();
        if (decision == ReviewDecision.REQUEST_CHANGES) {
            if (text.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Explique o ajuste que precisa ser feito.");
            }
            task.setStatus(TaskStatus.IN_PROGRESS);
            Task saved = taskRepository.save(task);
            if (comments != null) {
                comments.addReviewNote(saved, user, "CHANGES_REQUESTED", text);
            }
            publish(WorkEvent.Type.CHANGES_REQUESTED, saved, user, saved.getAssignee(), text);
            return saved;
        }
        task.setStatus(TaskStatus.DONE);
        Task saved = taskRepository.save(task);
        if (comments != null) {
            comments.addReviewNote(saved, user, "APPROVED", text.isEmpty() ? "Aprovada." : text);
        }
        publish(WorkEvent.Type.REVIEW_APPROVED, saved, user, saved.getAssignee(), null);
        return saved;
    }

    /** Define ou remove (userId nulo) o responsável. Quem pode criar tarefas pode atribuir. */
    @Transactional
    public Task assign(Long taskId, User user, Long assigneeId) {
        Task task = findVisibleTask(taskId, user);
        access.ensureCanManageTasks(task.getProject(), user);
        access.ensureActive(task.getProject());
        User previous = task.getAssignee();
        task.setAssignee(assigneeId == null ? null : access.requireParticipantUser(task.getProject(), assigneeId));
        Task saved = taskRepository.save(task);
        Long before = previous == null ? null : previous.getId();
        Long after = saved.getAssignee() == null ? null : saved.getAssignee().getId();
        if (!Objects.equals(before, after)) {
            publish(WorkEvent.Type.TASK_ASSIGNED, saved, user, saved.getAssignee(), null);
        }
        return saved;
    }

    /** Tarefa interna: fica fora da visão pública e não gera WIP. Quem pode criar tarefas decide. */
    @Transactional
    public Task setHiddenFromPublic(Long taskId, User user, boolean hidden) {
        Task task = findVisibleTask(taskId, user);
        access.ensureCanManageTasks(task.getProject(), user);
        task.setHiddenFromPublic(hidden);
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
