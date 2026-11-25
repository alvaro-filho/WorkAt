package com.example.backend.services;

import com.example.backend.dto.TaskCreateRequest;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectMember;
import com.example.backend.models.ProjectType;
import com.example.backend.models.Task;
import com.example.backend.models.TaskStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.ActivityEventRepository;
import com.example.backend.repositories.ProjectInvitationRepository;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Regras de acesso por tipo de projeto (tabela da seção 5 do documento de visão).
 */
class ProjectAccessRulesTest {
    private ProjectRepository projectRepository;
    private ProjectMemberRepository memberRepository;
    private TaskRepository taskRepository;
    private TaskService taskService;
    private ProjectService projectService;

    private User owner;
    private User member;
    private User outsider;
    private Project project;

    @BeforeEach
    void setUp() {
        projectRepository = mock(ProjectRepository.class);
        memberRepository = mock(ProjectMemberRepository.class);
        taskRepository = mock(TaskRepository.class);
        ProjectAccessService access = new ProjectAccessService(projectRepository, memberRepository);
        taskService = new TaskService(access, taskRepository, mock(TaskFileService.class));
        projectService = new ProjectService(projectRepository, taskRepository, mock(ActivityEventRepository.class),
                memberRepository, mock(ProjectInvitationRepository.class), access, mock(TaskFileService.class));

        owner = user(1L);
        member = user(2L);
        outsider = user(3L);
        project = new Project();
        project.setId(50L);
        project.setCreatedByUser(owner);

        when(projectRepository.findById(50L)).thenReturn(Optional.of(project));
        when(memberRepository.existsByProjectAndUser(project, member)).thenReturn(true);
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void outsiderGets404OnAnyProject() {
        project.setType(ProjectType.COOPERATIVE);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> taskService.listTasks(50L, outsider));

        assertEquals(404, exception.getStatusCode().value());
    }

    @Test
    void cooperativeMemberSeesAllTasks() {
        project.setType(ProjectType.COOPERATIVE);
        when(taskRepository.findByProjectOrderByCreatedAtAsc(project)).thenReturn(List.of(taskIn(project), taskIn(project)));

        assertEquals(2, taskService.listTasks(50L, member).size());
    }

    @Test
    void contractorSeesOnlyTasksAssignedToThem() {
        project.setType(ProjectType.CORPORATE);
        Task mine = taskIn(project);
        mine.setAssignee(member);
        Task other = taskIn(project);
        when(taskRepository.findByProjectOrderByCreatedAtAsc(project)).thenReturn(List.of(mine, other));

        assertEquals(List.of(mine), taskService.listTasks(50L, member));
        assertEquals(2, taskService.listTasks(50L, owner).size());
    }

    @Test
    void ownerCanLetContractorsSeeAllTasks() {
        project.setType(ProjectType.CORPORATE);
        project.setContractorsSeeAllTasks(true);
        when(taskRepository.findByProjectOrderByCreatedAtAsc(project)).thenReturn(List.of(taskIn(project), taskIn(project)));

        assertEquals(2, taskService.listTasks(50L, member).size());
    }

    @Test
    void contractorMovesOnlyTheirOwnTask() {
        project.setType(ProjectType.CORPORATE);
        project.setContractorsSeeAllTasks(true);
        Task mine = taskIn(project);
        mine.setAssignee(member);
        Task other = taskIn(project);
        other.setId(71L);
        when(taskRepository.findById(70L)).thenReturn(Optional.of(mine));
        when(taskRepository.findById(71L)).thenReturn(Optional.of(other));

        assertEquals(TaskStatus.REVIEW, taskService.updateStatus(70L, member, TaskStatus.REVIEW).getStatus());
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> taskService.updateStatus(71L, member, TaskStatus.DONE));
        assertEquals(403, exception.getStatusCode().value());
    }

    @Test
    void assigneeMustParticipateInTheProject() {
        project.setType(ProjectType.CORPORATE);
        when(memberRepository.findByProjectOrderByJoinedAtAsc(project)).thenReturn(List.of(new ProjectMember(project, member)));
        Task task = taskIn(project);
        when(taskRepository.findById(70L)).thenReturn(Optional.of(task));

        assertSame(member, taskService.assign(70L, owner, 2L).getAssignee());
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> taskService.assign(70L, owner, 3L));
        assertEquals(400, exception.getStatusCode().value());
        assertNull(taskService.assign(70L, owner, null).getAssignee());
    }

    @Test
    void contractorCannotAssignTasks() {
        project.setType(ProjectType.CORPORATE);
        Task task = taskIn(project);
        task.setAssignee(member);
        when(taskRepository.findById(70L)).thenReturn(Optional.of(task));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> taskService.assign(70L, member, 1L));
        assertEquals(403, exception.getStatusCode().value());
    }

    @Test
    void cooperativeMemberCanCreateAndMoveTasks() {
        project.setType(ProjectType.COOPERATIVE);

        Task created = taskService.createTask(50L, member, request("Cenário"));
        assertSame(project, created.getProject());

        Task task = taskIn(project);
        when(taskRepository.findById(70L)).thenReturn(Optional.of(task));
        assertEquals(TaskStatus.DONE, taskService.updateStatus(70L, member, TaskStatus.DONE).getStatus());
    }

    @Test
    void corporateMemberCannotCreateTasks() {
        project.setType(ProjectType.CORPORATE);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> taskService.createTask(50L, member, request("Personagem")));

        assertEquals(403, exception.getStatusCode().value());
        verify(taskRepository, never()).save(any());
    }

    @Test
    void contractorDoesNotEvenSeeAnUnassignedTask() {
        project.setType(ProjectType.CORPORATE);
        when(taskRepository.findById(70L)).thenReturn(Optional.of(taskIn(project)));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> taskService.updateStatus(70L, member, TaskStatus.DONE));

        assertEquals(404, exception.getStatusCode().value());
    }

    @Test
    void outsiderCannotTouchTaskEvenKnowingItsId() {
        project.setType(ProjectType.COOPERATIVE);
        when(taskRepository.findById(70L)).thenReturn(Optional.of(taskIn(project)));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> taskService.deleteTask(70L, outsider));

        assertEquals(404, exception.getStatusCode().value());
        verify(taskRepository, never()).delete(any());
    }

    @Test
    void memberCannotCloseOrDeleteTheProject() {
        project.setType(ProjectType.COOPERATIVE);

        ResponseStatusException close = assertThrows(ResponseStatusException.class,
                () -> projectService.updateStatus(50L, member, "CLOSED"));
        ResponseStatusException delete = assertThrows(ResponseStatusException.class,
                () -> projectService.deleteProject(50L, member));

        assertEquals(403, close.getStatusCode().value());
        assertEquals(403, delete.getStatusCode().value());
        verify(projectRepository, never()).delete(any(Project.class));
    }

    @Test
    void projectListIncludesOwnedAndMemberProjectsWithoutDuplicates() {
        Project owned = new Project();
        owned.setId(10L);
        owned.setCreatedByUser(member);
        when(projectRepository.findByCreatedByUser(member)).thenReturn(List.of(owned));
        when(memberRepository.findByUser(member)).thenReturn(List.of(new ProjectMember(project, member)));

        List<Project> projects = projectService.findProjectsForUser(member);

        assertEquals(List.of(owned, project), projects);
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private static Task taskIn(Project project) {
        Task task = new Task();
        task.setId(70L);
        task.setProject(project);
        return task;
    }

    private static TaskCreateRequest request(String title) {
        TaskCreateRequest request = new TaskCreateRequest();
        request.setTitle(title);
        return request;
    }
}
