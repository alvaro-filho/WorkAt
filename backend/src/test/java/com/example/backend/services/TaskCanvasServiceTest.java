package com.example.backend.services;

import com.example.backend.dto.TaskCanvasDto;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectType;
import com.example.backend.models.Task;
import com.example.backend.models.TaskCanvas;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskCanvasRepository;
import com.example.backend.repositories.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TaskCanvasServiceTest {
    private TaskCanvasRepository canvasRepository;
    private TaskCanvasService service;
    private User owner;
    private User contractor;
    private Project project;
    private Task task;

    @BeforeEach
    void setUp() {
        ProjectMemberRepository memberRepository = mock(ProjectMemberRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        canvasRepository = mock(TaskCanvasRepository.class);
        service = new TaskCanvasService(new ProjectAccessService(mock(ProjectRepository.class), memberRepository),
                taskRepository, canvasRepository);
        owner = user(1L);
        contractor = user(2L);
        project = new Project();
        project.setCreatedByUser(owner);
        project.setType(ProjectType.CORPORATE);
        project.setContractorsSeeAllTasks(true);
        task = new Task();
        task.setId(7L);
        task.setProject(project);
        when(taskRepository.findById(7L)).thenReturn(Optional.of(task));
        when(memberRepository.existsByProjectAndUser(project, contractor)).thenReturn(true);
        when(canvasRepository.save(any(TaskCanvas.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void emptyCanvasWhenNothingSavedYet() {
        assertEquals("[]", service.get(7L, contractor).content());
    }

    @Test
    void responsibleSavesTheCanvas() {
        task.setAssignee(contractor);

        TaskCanvasDto saved = service.save(7L, contractor, " [{\"type\":\"note\"}] ");

        assertEquals("[{\"type\":\"note\"}]", saved.content());
    }

    @Test
    void contractorWhoIsNotResponsibleOnlyReads() {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.save(7L, contractor, "[]"));

        assertEquals(403, exception.getStatusCode().value());
    }

    @Test
    void rejectsInvalidFormat() {
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.save(7L, owner, "{\"x\":1}")).getStatusCode().value());
    }

    @Test
    void outsiderGets404() {
        assertEquals(404, assertThrows(ResponseStatusException.class,
                () -> service.get(7L, user(99L))).getStatusCode().value());
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }
}
