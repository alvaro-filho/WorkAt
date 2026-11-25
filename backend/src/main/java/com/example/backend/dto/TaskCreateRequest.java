package com.example.backend.dto;

import com.example.backend.models.TaskPriority;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

@JsonIgnoreProperties(ignoreUnknown = true)
public class TaskCreateRequest {

    @NotBlank(message = "O título é obrigatório.")
    private String title;
    private String description;
    @NotNull(message = "A prioridade deve ser LOW, MEDIUM ou HIGH.")
    private TaskPriority priority = TaskPriority.MEDIUM;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate deadline;

    /** Responsável opcional (id de um participante do projeto). */
    private Long assigneeId;

    public Long getAssigneeId() { return assigneeId; }
    public void setAssigneeId(Long assigneeId) { this.assigneeId = assigneeId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public TaskPriority getPriority() { return priority; }
    public void setPriority(TaskPriority priority) { this.priority = priority; }
    public LocalDate getDeadline() { return deadline; }
    public void setDeadline(LocalDate deadline) { this.deadline = deadline; }
}
