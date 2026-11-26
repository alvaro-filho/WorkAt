package com.example.backend.events;

import com.example.backend.models.Notification;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectHistory;
import com.example.backend.models.Task;
import com.example.backend.models.User;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.ProjectHistoryRepository;
import com.example.backend.services.ProjectAccessService;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Transforma cada {@link WorkEvent} em uma linha no histórico do projeto e nos avisos de quem precisa saber.
 * Roda na mesma transação de quem publicou: se a ação falhar, nada é gravado.
 */
@Component
public class WorkEventListener {

    private final ProjectHistoryRepository historyRepository;
    private final NotificationRepository notificationRepository;

    public WorkEventListener(ProjectHistoryRepository historyRepository, NotificationRepository notificationRepository) {
        this.historyRepository = historyRepository;
        this.notificationRepository = notificationRepository;
    }

    @EventListener
    public void on(WorkEvent event) {
        String history = historyMessage(event);
        if (history != null && event.project() != null) {
            ProjectHistory row = new ProjectHistory();
            row.setProject(event.project());
            row.setActor(event.actor());
            row.setType(event.type().name());
            row.setMessage(cut(history));
            row.setTaskId(event.task() == null ? null : event.task().getId());
            historyRepository.save(row);
        }
        notify(event);
    }

    private void notify(WorkEvent e) {
        Project p = e.project();
        Task t = e.task();
        String actor = name(e.actor());
        String project = p == null ? "" : p.getName();
        String task = t == null ? "" : "“" + t.getTitle() + "”";
        switch (e.type()) {
            case INVITE_SENT -> send(e.target(), e, actor + " convidou você para o projeto " + project + ".",
                    "/notificacoes?aba=convites", null);
            case INVITE_DECLINED -> send(e.target(), e, actor + " recusou o convite para o projeto " + project + ".",
                    projectLink(p), null);
            case MEMBER_JOINED -> send(owner(p), e, actor + " entrou no projeto " + project + ".", projectLink(p), null);
            case MEMBER_LEFT -> send(owner(p), e, actor + " saiu do projeto " + project
                    + ". As tarefas dessa pessoa ficaram sem responsável.", projectLink(p), null);
            case MEMBER_REMOVED -> send(e.target(), e, "Você foi removido do projeto " + project + ".", "/projetos", null);
            case OWNERSHIP_TRANSFERRED -> send(e.target(), e, actor + " passou para você o projeto " + project + ".",
                    projectLink(p), null);
            case TASK_ASSIGNED -> send(e.target(), e, "Nova tarefa para você: " + task + " (" + project + ").",
                    taskLink(p, t), null);
            case REVIEW_REQUESTED -> send(owner(p), e, actor + " enviou " + task + " para revisão.", taskLink(p, t), null);
            case REVIEW_APPROVED -> send(e.target(), e, actor + " aprovou " + task + ".", taskLink(p, t), null);
            case CHANGES_REQUESTED -> send(e.target(), e, "Ajuste pedido em " + task + ": " + e.detail(), taskLink(p, t), null);
            case COMMENT_ADDED -> {
                Set<User> people = new LinkedHashSet<>();
                if (t != null && t.getAssignee() != null) people.add(t.getAssignee());
                if (owner(p) != null) people.add(owner(p));
                for (User person : people) {
                    send(person, e, actor + " comentou em " + task + ": " + e.detail(), taskLink(p, t), null);
                }
            }
            case DEADLINE_SOON -> send(e.target(), e, "O prazo de " + task + " (" + project + ") vence amanhã.",
                    taskLink(p, t), "deadline:" + (t == null ? "" : t.getId()) + ":" + e.detail());
            default -> {
                // Os outros eventos só entram no histórico.
            }
        }
    }

    private void send(User to, WorkEvent e, String message, String link, String refKey) {
        if (to == null || ProjectAccessService.sameUser(to, e.actor())) {
            return; // Ninguém é avisado do que ele mesmo fez.
        }
        if (refKey != null && notificationRepository.existsByUserAndRefKey(to, refKey)) {
            return;
        }
        Notification n = new Notification();
        n.setUser(to);
        n.setType(e.type().name());
        n.setMessage(cut(message));
        n.setLink(link);
        n.setRefKey(refKey);
        notificationRepository.save(n);
    }

    static String historyMessage(WorkEvent e) {
        String actor = name(e.actor());
        String target = name(e.target());
        String task = e.task() == null ? "" : "“" + e.task().getTitle() + "”";
        return switch (e.type()) {
            case INVITE_SENT -> actor + " convidou " + target + ".";
            case INVITE_CANCELLED -> actor + " cancelou o convite de " + target + ".";
            case INVITE_DECLINED -> actor + " recusou o convite.";
            case MEMBER_JOINED -> actor + " entrou no projeto.";
            case MEMBER_LEFT -> actor + " saiu do projeto.";
            case MEMBER_REMOVED -> actor + " removeu " + target + " do projeto.";
            case OWNERSHIP_TRANSFERRED -> actor + " passou o projeto para " + target + ".";
            case TASK_CREATED -> actor + " criou a tarefa " + task + ".";
            case TASK_ASSIGNED -> e.target() == null
                    ? actor + " deixou " + task + " sem responsável."
                    : actor + " atribuiu " + task + " a " + target + ".";
            case TASK_STATUS -> actor + " moveu " + task + " para " + e.detail() + ".";
            case REVIEW_REQUESTED -> actor + " enviou " + task + " para revisão.";
            case REVIEW_APPROVED -> actor + " aprovou " + task + ".";
            case CHANGES_REQUESTED -> actor + " pediu ajuste em " + task + ": " + e.detail();
            case FILE_UPLOADED -> actor + " enviou " + e.detail() + " em " + task + ".";
            case COMMENT_ADDED -> actor + " comentou em " + task + ".";
            case DEADLINE_SOON -> null;
        };
    }

    private static User owner(Project project) {
        return project == null ? null : project.getCreatedByUser();
    }

    private static String name(User user) {
        return user == null ? "Alguém" : user.getFullName();
    }

    private static String projectLink(Project p) {
        return p == null ? "/projetos" : "/projetos/" + p.getId();
    }

    private static String taskLink(Project p, Task t) {
        return p == null || t == null ? projectLink(p) : "/projetos/" + p.getId() + "/tarefas/" + t.getId();
    }

    private static String cut(String text) {
        return text.length() > 500 ? text.substring(0, 497) + "..." : text;
    }
}
