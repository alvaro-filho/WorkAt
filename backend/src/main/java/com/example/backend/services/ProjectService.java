package com.example.backend.services;

import com.example.backend.models.Project;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.ActivityEventRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

/**
 * Serviço de negócio para gerenciamento de projetos (RF005).
 */
@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final ActivityEventRepository activityEventRepository;
    // Poderíamos injetar o UserRepository aqui para associar o criador do projeto.
    // private final UserRepository userRepository; 

    public ProjectService(ProjectRepository projectRepository, TaskRepository taskRepository,
                          ActivityEventRepository activityEventRepository) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.activityEventRepository = activityEventRepository;
    }

    /**
     * Lista todos os projetos existentes no sistema.
     * Este método será o ponto de entrada principal para o Dashboard.
     * @return Uma lista de todos os projetos.
     */
    @Transactional(readOnly = true)
    public List<Project> findAllProjects() {
        // Retorna todos os projetos, ou uma lista vazia se não houver nenhum.
        return projectRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Project> findProjectsForUser(User user) {
        return projectRepository.findByCreatedByUser(user);
    }

    /**
     * Busca um projeto específico pelo seu ID.
     * @param projectId O ID do projeto.
     * @return Um Optional contendo o projeto, se existir.
     */
    @Transactional(readOnly = true)
    public Optional<Project> findProjectById(Long projectId) {
        return projectRepository.findById(projectId);
    }

    /**
     * Temporary access rule until ProjectMember is implemented: only the creator can read the project.
     */
    @Transactional(readOnly = true)
    public Optional<Project> findProjectByIdForCreator(Long projectId, User creator) {
        return projectRepository.findByIdAndCreatedByUser(projectId, creator);
    }

    /**
     * Cria um novo projeto no sistema.
     * @param project Os dados do projeto a ser criado.
     * @param creator O usuário que está criando o projeto.
     * @return O projeto salvo com seu ID gerado.
     */
    @Transactional
    public Project createProject(Project project, User creator) {
        // Configura o usuário criador antes de salvar
        project.setCreatedByUser(creator);
        // É crucial garantir que o slug seja único ou gerado corretamente.
        // Aqui assumimos que o serviço de criação de slug é tratado ou que o input é limpo.
        
        return projectRepository.save(project);
    }

    @Transactional
    public Project updateStatus(Long projectId, User creator, String requestedStatus) {
        Project project = projectRepository.findByIdAndCreatedByUser(projectId, creator)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado."));
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
    public void deleteProject(Long projectId, User creator) {
        Project project = projectRepository.findByIdAndCreatedByUser(projectId, creator)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado."));
        if (project.getStatus() != ProjectStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Encerre o projeto antes de apagá-lo.");
        }
        activityEventRepository.deleteByProject(project);
        taskRepository.deleteByProject(project);
        projectRepository.delete(project);
    }
}
