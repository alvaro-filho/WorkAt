package com.example.backend.services;

import com.example.backend.events.WorkEvent;
import com.example.backend.models.Task;
import com.example.backend.models.TaskComment;
import com.example.backend.models.TaskFile;
import com.example.backend.models.User;
import com.example.backend.repositories.TaskCommentRepository;
import com.example.backend.repositories.TaskFileRepository;
import com.example.backend.repositories.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Conversa da tarefa. Quem vê a tarefa pode ler e comentar; o comentário pode apontar para uma versão de arquivo.
 * As decisões da revisão (aprovar, pedir ajuste) entram aqui também, para ficar tudo num lugar só.
 */
@Service
public class TaskCommentService {

    public static final int MAX_LENGTH = 4000;

    private final ProjectAccessService access;
    private final TaskRepository taskRepository;
    private final TaskFileRepository fileRepository;
    private final TaskCommentRepository commentRepository;
    private ApplicationEventPublisher events;

    public TaskCommentService(ProjectAccessService access, TaskRepository taskRepository,
                              TaskFileRepository fileRepository, TaskCommentRepository commentRepository) {
        this.access = access;
        this.taskRepository = taskRepository;
        this.fileRepository = fileRepository;
        this.commentRepository = commentRepository;
    }

    @Autowired(required = false)
    public void setEvents(ApplicationEventPublisher events) {
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<TaskComment> list(Long taskId, User user) {
        return commentRepository.findByTaskOrderByIdAsc(findVisibleTask(taskId, user));
    }

    @Transactional
    public TaskComment add(Long taskId, User user, String body, Long fileId) {
        Task task = findVisibleTask(taskId, user);
        access.ensureActive(task.getProject());
        String text = clean(body);
        TaskFile file = null;
        if (fileId != null) {
            file = fileRepository.findById(fileId)
                    .filter(candidate -> candidate.getTask().getId().equals(task.getId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Essa versão não é desta tarefa."));
        }
        TaskComment saved = save(task, user, "COMMENT", text, file);
        if (events != null) {
            events.publishEvent(WorkEvent.of(WorkEvent.Type.COMMENT_ADDED, task.getProject(), task, user, null,
                    preview(text)));
        }
        return saved;
    }

    /** Registro da revisão na conversa (sem aviso próprio: a revisão já avisa). */
    @Transactional
    public TaskComment addReviewNote(Task task, User author, String kind, String body) {
        return save(task, author, kind, clean(body), null);
    }

    @Transactional
    public void delete(Long commentId, User user) {
        TaskComment comment = commentRepository.findById(commentId)
                .filter(candidate -> access.canSeeTask(candidate.getTask(), user))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comentário não encontrado."));
        boolean owner = ProjectAccessService.isOwner(comment.getTask().getProject(), user);
        if (!ProjectAccessService.sameUser(comment.getAuthor(), user) && !owner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Só quem escreveu ou o dono do projeto pode apagar o comentário.");
        }
        if (!"COMMENT".equals(comment.getKind())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Registros da revisão não podem ser apagados.");
        }
        commentRepository.delete(comment);
    }

    private TaskComment save(Task task, User author, String kind, String body, TaskFile file) {
        TaskComment comment = new TaskComment();
        comment.setTask(task);
        comment.setAuthor(author);
        comment.setKind(kind);
        comment.setBody(body);
        comment.setFile(file);
        return commentRepository.save(comment);
    }

    private static String clean(String body) {
        String text = body == null ? "" : body.trim();
        if (text.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escreva o comentário.");
        }
        if (text.length() > MAX_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "O comentário deve ter no máximo " + MAX_LENGTH + " caracteres.");
        }
        return text;
    }

    private static String preview(String text) {
        return text.length() > 120 ? text.substring(0, 117) + "..." : text;
    }

    private Task findVisibleTask(Long taskId, User user) {
        return taskRepository.findById(taskId)
                .filter(task -> access.canSeeTask(task, user))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarefa não encontrada."));
    }
}
