package com.example.backend.services;

import com.example.backend.models.Project;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.ActivityEventRepository;
import com.example.backend.repositories.ProjectInvitationRepository;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProjectServiceTest {
    private ProjectRepository projectRepository;
    private TaskRepository taskRepository;
    private ActivityEventRepository activityEventRepository;
    private ProjectMemberRepository memberRepository;
    private ProjectInvitationRepository invitationRepository;
    private ProjectService projectService;
    private User creator;
    private Project project;

    @BeforeEach
    void setUp() {
        projectRepository = mock(ProjectRepository.class);
        taskRepository = mock(TaskRepository.class);
        activityEventRepository = mock(ActivityEventRepository.class);
        memberRepository = mock(ProjectMemberRepository.class);
        invitationRepository = mock(ProjectInvitationRepository.class);
        projectService = new ProjectService(projectRepository, taskRepository, activityEventRepository,
                memberRepository, invitationRepository, new ProjectAccessService(projectRepository, memberRepository),
                mock(TaskFileService.class));
        creator = new User();
        project = new Project();
        project.setId(31L);
        project.setCreatedByUser(creator);
    }

    @Test
    void closesAndResumesOwnedProject() {
        when(projectRepository.findById(31L)).thenReturn(Optional.of(project));
        when(projectRepository.save(project)).thenReturn(project);

        assertSame(project, projectService.updateStatus(31L, creator, "CLOSED"));
        assertEquals(ProjectStatus.CLOSED, project.getStatus());
        assertSame(project, projectService.updateStatus(31L, creator, "ACTIVE"));
        assertEquals(ProjectStatus.ACTIVE, project.getStatus());
    }

    @Test
    void cannotCloseAnotherCreatorsProject() {
        when(projectRepository.findById(31L)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> projectService.updateStatus(31L, creator, "CLOSED"));

        assertEquals(404, exception.getStatusCode().value());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void cannotDeleteActiveProject() {
        when(projectRepository.findById(31L)).thenReturn(Optional.of(project));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> projectService.deleteProject(31L, creator));

        assertEquals(409, exception.getStatusCode().value());
        assertEquals("Encerre o projeto antes de apagá-lo.", exception.getReason());
        verifyNoInteractions(taskRepository, activityEventRepository);
        verify(projectRepository, never()).delete(any(Project.class));
    }

    @Test
    void deletesClosedProjectAndItsTasksAndActivityEvents() {
        project.setStatus(ProjectStatus.CLOSED);
        when(projectRepository.findById(31L)).thenReturn(Optional.of(project));

        projectService.deleteProject(31L, creator);

        verify(activityEventRepository).deleteByProject(project);
        verify(taskRepository).deleteByProject(project);
        verify(invitationRepository).deleteByProject(project);
        verify(memberRepository).deleteByProject(project);
        verify(projectRepository).delete(project);
    }

    @Test
    void rejectsInvalidProjectStatus() {
        when(projectRepository.findById(31L)).thenReturn(Optional.of(project));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> projectService.updateStatus(31L, creator, "PAUSED"));

        assertEquals(400, exception.getStatusCode().value());
        assertEquals("Status inválido. Use ACTIVE ou CLOSED.", exception.getReason());
        verify(projectRepository, never()).save(any(Project.class));
    }
}
