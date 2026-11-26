package com.example.backend.dto;

import com.example.backend.models.Task;
import com.example.backend.models.TaskPriority;
import com.example.backend.models.TaskStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class TaskResponse {
    private final Long id;
    private final String title;
    private final String description;
    private final TaskPriority priority;
    private final TaskStatus status;
    private final LocalDate deadline;
    private final Long projectId;
    private final String projectName;
    private final UserSummary assignee;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;
    private final boolean hiddenFromPublic;

    private TaskResponse(Task task) {
        this.id = task.getId();
        this.title = task.getTitle();
        this.description = task.getDescription();
        this.priority = task.getPriority();
        this.status = task.getStatus();
        this.deadline = task.getDeadline();
        this.projectId = task.getProject().getId();
        this.projectName = task.getProject().getName();
        this.assignee = UserSummary.from(task.getAssignee());
        this.createdAt = task.getCreatedAt();
        this.updatedAt = task.getUpdatedAt();
        this.hiddenFromPublic = task.isHiddenFromPublic();
    }

    public static TaskResponse from(Task task) { return new TaskResponse(task); }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public TaskPriority getPriority() { return priority; }
    public TaskStatus getStatus() { return status; }
    public LocalDate getDeadline() { return deadline; }
    public Long getProjectId() { return projectId; }
    public String getProjectName() { return projectName; }
    public UserSummary getAssignee() { return assignee; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public boolean isHiddenFromPublic() { return hiddenFromPublic; }
}
