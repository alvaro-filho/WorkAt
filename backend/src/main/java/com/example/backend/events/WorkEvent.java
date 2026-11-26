package com.example.backend.events;

import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.User;

/**
 * Algo que aconteceu num projeto. Um único ouvinte grava o histórico do projeto e as notificações.
 * task, actor, target e detail são opcionais conforme o tipo.
 */
public record WorkEvent(Type type, Project project, Task task, User actor, User target, String detail) {

    public enum Type {
        INVITE_SENT,
        INVITE_CANCELLED,
        INVITE_DECLINED,
        MEMBER_JOINED,
        MEMBER_LEFT,
        MEMBER_REMOVED,
        OWNERSHIP_TRANSFERRED,
        TASK_CREATED,
        TASK_ASSIGNED,
        TASK_STATUS,
        REVIEW_REQUESTED,
        REVIEW_APPROVED,
        CHANGES_REQUESTED,
        FILE_UPLOADED,
        COMMENT_ADDED,
        DEADLINE_SOON
    }

    public static WorkEvent of(Type type, Project project, Task task, User actor, User target, String detail) {
        return new WorkEvent(type, project, task, actor, target, detail);
    }
}
