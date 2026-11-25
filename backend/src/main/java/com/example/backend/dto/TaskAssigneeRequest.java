package com.example.backend.dto;

/** Define (userId) ou remove (null) o responsável da tarefa. */
public class TaskAssigneeRequest {
    private Long userId;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
}
