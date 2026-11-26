package com.example.backend.services;

import com.example.backend.events.WorkEvent;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectMember;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.ProjectType;
import com.example.backend.models.User;
import com.example.backend.repositories.ActivityEventRepository;
import com.example.backend.repositories.ProjectInvitationRepository;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
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
    private final TaskFileService taskFileService;
    private final PostService postService;

    public ProjectService(ProjectRepository projectRepository, TaskRepository taskRepository,
                          ActivityEventRepository activityEventRepository,
                          ProjectMemberRepository memberRepository,
                          ProjectInvitationRepository invitationRepository,
                          ProjectAccessService access,
                          TaskFileService taskFileService,
                          PostService postService) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.activityEventRepository = activityEventRepository;
        this.memberRepository = memberRepository;
        this.invitationRepository = invitationRepository;
        this.access = access;
        this.taskFileService = taskFileService;
        this.postService = postService;
    }

    private ApplicationEventPublisher events;

    @Autowired(required = false)
    public void setEvents(ApplicationEventPublisher events) {
        this.events = events;
    }

    /**
     * O dono passa o projeto para um membro: o membro vira dono e o antigo dono continua como membro.
     * Sem isso o dono nunca consegue sair do projeto.
     */
    @Transactional
    public Project transferOwnership(Long projectId, User owner, Long newOwnerId) {
        if (newOwnerId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escolha para quem passar o projeto.");
        }
        Project project = access.requireOwner(projectId, owner);
        ProjectMember membership = memberRepository.findByProjectOrderByJoinedAtAsc(project).stream()
                .filter(member -> newOwnerId.equals(member.getUser().getId()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "O novo dono precisa ser membro do projeto."));
        User newOwner = membership.getUser();
        memberRepository.delete(membership);
        memberRepository.flush();
        project.setCreatedByUser(newOwner);
        Project saved = projectRepository.save(project);
        memberRepository.save(new ProjectMember(saved, owner));
        if (events != null) {
            events.publishEvent(WorkEvent.of(WorkEvent.Type.OWNERSHIP_TRANSFERRED, saved, null, owner, newOwner, null));
        }
        return saved;
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
        String name = project.getName() == null ? "" : project.getName().trim();
        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O nome do projeto é obrigatório.");
        }
        if (name.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O nome do projeto deve ter no máximo 255 caracteres.");
        }
        String slug = project.getSlug() == null ? "" : project.getSlug().trim();
        if (slug.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O endereço (slug) do projeto é obrigatório.");
        }
        if (projectRepository.findBySlug(slug).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Já existe um projeto com esse endereço. Tente de novo ou mude o nome.");
        }
        project.setName(name);
        project.setSlug(slug);
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

    /**
     * Configurações do dono.
     * Qualquer tipo: WIP automático (projeto público). Só corporativo: contratados veem tudo, NDA e data de liberação.
     * ndaReleaseDate: null = não muda, "" = tira a data, "AAAA-MM-DD" = define.
     */
    @Transactional
    public Project updateSettings(Long projectId, User user, Boolean contractorsSeeAllTasks, Boolean ndaEnabled,
                                  Boolean autoWip, String ndaReleaseDate) {
        Project project = access.requireOwner(projectId, user);
        if ((contractorsSeeAllTasks != null || ndaEnabled != null || ndaReleaseDate != null)
                && project.getType() != ProjectType.CORPORATE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Essas opções só existem em projetos corporativos.");
        }
        if (contractorsSeeAllTasks != null) {
            project.setContractorsSeeAllTasks(contractorsSeeAllTasks);
        }
        if (ndaEnabled != null) {
            project.setNdaEnabled(ndaEnabled);
        }
        if (ndaReleaseDate != null) {
            project.setNdaReleaseDate(parseReleaseDate(ndaReleaseDate));
        }
        boolean turnedPublic = autoWip != null && autoWip && !project.isAutoWip();
        if (autoWip != null) {
            project.setAutoWip(autoWip);
        }
        if (turnedPublic && project.getPublicSince() == null) {
            project.setPublicSince(java.time.LocalDateTime.now());
        }
        Project saved = projectRepository.save(project);
        if (turnedPublic) {
            postService.recordProjectPublished(saved, user);
        }
        return saved;
    }

    private static java.time.LocalDate parseReleaseDate(String value) {
        if (value.isBlank()) {
            return null;
        }
        try {
            return java.time.LocalDate.parse(value.trim());
        } catch (java.time.format.DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data de liberação inválida (use AAAA-MM-DD).");
        }
    }

    @Transactional
    public void deleteProject(Long projectId, User user) {
        Project project = access.requireOwner(projectId, user);

        if (project.getStatus() != ProjectStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Encerre o projeto antes de apagá-lo.");
        }

        activityEventRepository.deleteByProject(project);
        postService.deleteAllForProject(project);
        taskFileService.deleteAllForProject(project);
        taskRepository.deleteByProject(project);
        invitationRepository.deleteByProject(project);
        memberRepository.deleteByProject(project);
        projectRepository.delete(project);
    }
}
