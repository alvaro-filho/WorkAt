package com.example.backend.services;

import com.example.backend.models.Project;
import com.example.backend.models.ProjectRole;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.ProjectType;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;
import java.util.Optional;

/**
 * Regras centrais de acesso por projeto: quem participa e o que cada papel pode fazer
 * em cada tipo de projeto (ver a tabela da seção 5 do documento de visão).
 *
 * Quem não participa recebe 404, para não revelar que o projeto existe.
 * Quem participa, mas não tem permissão para a ação, recebe 403.
 */
@Service
public class ProjectAccessService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;

    public ProjectAccessService(ProjectRepository projectRepository, ProjectMemberRepository memberRepository) {
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
    }

    /** Papel do usuário no projeto, ou vazio se ele não participa. */
    @Transactional(readOnly = true)
    public Optional<ProjectRole> roleOf(Project project, User user) {
        if (isOwner(project, user)) {
            return Optional.of(ProjectRole.OWNER);
        }
        if (user != null && memberRepository.existsByProjectAndUser(project, user)) {
            return Optional.of(ProjectRole.MEMBER);
        }
        return Optional.empty();
    }

    /** Projeto em que o usuário participa (dono ou membro); 404 caso contrário. */
    @Transactional(readOnly = true)
    public Project requireParticipant(Long projectId, User user) {
        Project project = projectRepository.findById(projectId).orElseThrow(ProjectAccessService::notFound);
        if (roleOf(project, user).isEmpty()) {
            throw notFound();
        }
        return project;
    }

    /** Projeto do qual o usuário é dono; 404 se não participa, 403 se é só membro. */
    @Transactional(readOnly = true)
    public Project requireOwner(Long projectId, User user) {
        Project project = requireParticipant(projectId, user);
        if (!isOwner(project, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só o dono do projeto pode fazer isso.");
        }
        return project;
    }

    /** Criar e apagar tarefas: dono sempre; membros só no cooperativo. */
    public void ensureCanManageTasks(Project project, User user) {
        if (isOwner(project, user)) {
            return;
        }
        if (project.getType() != ProjectType.COOPERATIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Neste projeto só o dono pode criar ou apagar tarefas.");
        }
    }

    /**
     * Mover tarefas: dono sempre; membros no cooperativo.
     * No corporativo, o contratado vai poder mover as tarefas atribuídas a ele (fatia 2).
     */
    public void ensureCanMoveTasks(Project project, User user) {
        if (isOwner(project, user)) {
            return;
        }
        if (project.getType() != ProjectType.COOPERATIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Neste projeto só o dono pode mover as tarefas.");
        }
    }

    public void ensureActive(Project project) {
        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Projeto encerrado. Retome o projeto para alterar tarefas.");
        }
    }

    public static boolean isOwner(Project project, User user) {
        return sameUser(project.getCreatedByUser(), user);
    }

    public static boolean sameUser(User a, User b) {
        if (a == null || b == null) {
            return false;
        }
        if (a == b) {
            return true;
        }
        return a.getId() != null && Objects.equals(a.getId(), b.getId());
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado.");
    }
}
