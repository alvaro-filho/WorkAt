package com.example.backend.services;

import com.example.backend.models.Project;
import com.example.backend.models.ProjectMember;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.ActivityEventRepository;
import com.example.backend.repositories.ProjectInvitationRepository;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Serviço de negócio para gerenciamento de projetos.
 * A autorização por participação fica no {@link ProjectAccessService}.
 */
@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final ActivityEventRepository activityEventRepository;
    private final ProjectMemberRepository memberRepository;
    private final ProjectInvitationRepository invitationRepository;
    private final ProjectAccessService access;

    public ProjectService(ProjectRepository projectRepository, TaskRepository taskRepository,
                          ActivityEventRepository activityEventRepository,
                          ProjectMemberRepository memberRepository,
                          ProjectInvitationRepository invitationRepository,
                          ProjectAccessService access) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.activityEventRepository = activityEventRepository;
        this.memberRepository = memberRepository;
        this.invitationRepository = invitationRepository;
        this.access = access;
    }

    /** Projetos em que o usuário participa: os que ele criou e os em que é membro. */
    @Transactional(readOnly = true)
    public List<Project> findProjectsForUser(User user) {
        Map<Long, Project> byId = new LinkedHashMap<>();
        for (Project project : projectRepository.findByCreatedByUser(user)) {
            byId.put(project.getId(), project);
        }
        for (ProjectMember membership : memberRepository.findByUser(user)) {
            byId.putIfAbsent(membership.getProject().getId(), membership.getProject());
        }
        return byId.values().stream()
                .sorted(Comparator.comparing(Project::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    @Transactional(readOnly = true)
    public Project findProjectForParticipant(Long projectId, User user) {
        return access.requireParticipant(projectId, user);
    }

    @Transactional
    public Project createProject(Project project, User creator) {
        project.setCreatedByUser(creator);
        return projectRepository.save(project);
    }

    @Transactional
    public Project updateStatus(Long projectId, User user, String requestedStatus) {
        Project project = access.requireOwner(projectId, user);

        if (requestedStatus == null || requestedStatus.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O status é obrigatório. Use ACTIVE ou CLOSED.");
        }

        ProjectStatus status;
        try {
            status = ProjectStatus.valueOf(requestedStatus);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status inválido. Use ACTIVE ou CLOSED.");
        }

        project.setStatus(status);
        return projectRepository.save(project);
    }

    @Transactional
    public void deleteProject(Long projectId, User user) {
        Project project = access.requireOwner(projectId, user);

        if (project.getStatus() != ProjectStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Encerre o projeto antes de apagá-lo.");
        }

        activityEventRepository.deleteByProject(project);
        taskRepository.deleteByProject(project);
        invitationRepository.deleteByProject(project);
        memberRepository.deleteByProject(project);
        projectRepository.delete(project);
    }
}
