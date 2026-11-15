package com.example.backend.services;

import com.example.backend.dto.TaskCreateRequest;
import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.TaskPriority;
import com.example.backend.models.TaskStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TaskServiceTest {
    private ProjectRepository projectRepository;
    private TaskRepository taskRepository;
    private TaskService taskService;
    private User creator;
    private Project project;

    @BeforeEach
    void setUp() {
        projectRepository = mock(ProjectRepository.class);
        taskRepository = mock(TaskRepository.class);
        taskService = new TaskService(projectRepository, taskRepository);
        creator = new User();
        project = new Project();
        project.setId(15L);
        project.setCreatedByUser(creator);
    }

    @Test
    void createsTaskWithTodoAndDefaultMediumPriority() {
        when(projectRepository.findByIdAndCreatedByUser(15L, creator)).thenReturn(Optional.of(project));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));
        TaskCreateRequest request = new TaskCreateRequest();
        request.setTitle("  Draft  ");
        request.setDescription("First pass");

        Task created = taskService.createTask(15L, creator, request);

        assertEquals("Draft", created.getTitle());
        assertEquals("First pass", created.getDescription());
        assertEquals(TaskPriority.MEDIUM, created.getPriority());
        assertEquals(TaskStatus.TODO, created.getStatus());
        assertSame(project, created.getProject());
        verify(taskRepository).save(created);
    }

    @Test
    void doesNotCreateTaskInAnotherCreatorsProject() {
        when(projectRepository.findByIdAndCreatedByUser(15L, creator)).thenReturn(Optional.empty());
        TaskCreateRequest request = new TaskCreateRequest();
        request.setTitle("Draft");

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> taskService.createTask(15L, creator, request));

        assertEquals(404, exception.getStatusCode().value());
        verify(taskRepository, never()).save(any());
    }

    @Test
    void movesTaskStatusForItsCreator() {
        Task task = new Task();
        task.setProject(project);
        when(taskRepository.findByIdAndProject_CreatedByUser(22L, creator)).thenReturn(Optional.of(task));
        when(taskRepository.save(task)).thenReturn(task);

        Task updated = taskService.updateStatus(22L, creator, TaskStatus.IN_PROGRESS);

        assertSame(task, updated);
        assertEquals(TaskStatus.IN_PROGRESS, updated.getStatus());
        verify(taskRepository).save(task);
    }

    @Test
    void doesNotMoveTaskFromAnotherCreatorsProject() {
        when(taskRepository.findByIdAndProject_CreatedByUser(22L, creator)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> taskService.updateStatus(22L, creator, TaskStatus.DONE));

        assertEquals(404, exception.getStatusCode().value());
        verify(taskRepository, never()).save(any());
    }

    @Test
    void rejectsBlankTitle() {
        TaskCreateRequest request = new TaskCreateRequest();
        request.setTitle("  \t");

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> taskService.createTask(15L, creator, request));

        assertEquals(400, exception.getStatusCode().value());
        assertTrue(exception.getReason().contains("O título é obrigatório."));
        verifyNoInteractions(projectRepository, taskRepository);
    }
}
