package com.example.backend.services;

import com.example.backend.dto.PublicProjectResponse;
import com.example.backend.dto.UserSummary;
import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.TaskFile;
import com.example.backend.models.TaskStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskFileRepository;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Visão pública do projeto (linha do tempo de atualizações).
 * Qualquer pessoa vê se o projeto é público (WIP automático, sem NDA ativo). Participantes também podem
 * pré-visualizar ("Ver como público") um projeto ainda privado, vendo só as tarefas que já podem ver.
 * Tarefas internas e tarefas sem imagem ficam de fora.
 */
@Service
public class PublicProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;
    private final TaskFileRepository fileRepository;
    private final ProjectAccessService access;
    private final FileStorage storage;

    public PublicProjectService(ProjectRepository projectRepository, ProjectMemberRepository memberRepository,
                                TaskFileRepository fileRepository, ProjectAccessService access, FileStorage storage) {
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
        this.fileRepository = fileRepository;
        this.access = access;
        this.storage = storage;
    }

    private PostService postService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setPostService(PostService postService) {
        this.postService = postService;
    }

    /** Aba Projetos do Explorar: projetos abertos ao público (sem NDA ativo), com atividade mais recente primeiro. */
    @Transactional(readOnly = true)
    public List<com.example.backend.dto.PublicProjectCard> listPublic(int limit) {
        List<com.example.backend.dto.PublicProjectCard> cards = new ArrayList<>();
        for (Project project : projectRepository.findByAutoWipTrue()) {
            if (!PostService.isProjectPublic(project)) {
                continue;
            }
            List<TaskFile> images = fileRepository.findByTask_Project(project).stream()
                    .filter(file -> showsInPublicView(file, null, true))
                    .sorted(Comparator.comparing(TaskFile::getCreatedAt).reversed())
                    .toList();
            if (images.isEmpty()) {
                continue;
            }
            String cover = postService == null ? null : postService.coverOf(project).orElse(null);
            if (cover == null) {
                cover = "/api/v1/projects/" + project.getId() + "/public/files/" + images.get(0).getId();
            }
            cards.add(new com.example.backend.dto.PublicProjectCard(project.getId(), project.getName(),
                    project.getDescription(), project.getType(), UserSummary.from(project.getCreatedByUser()),
                    cover, images.size(), images.get(0).getCreatedAt()));
        }
        cards.sort(Comparator.comparing(com.example.backend.dto.PublicProjectCard::lastActivityAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return cards.size() > limit ? cards.subList(0, limit) : cards;
    }

    /** order: "asc" (padrão, mais antiga primeiro, conta a história) ou "desc". */
    @Transactional(readOnly = true)
    public PublicProjectResponse view(Long projectId, User viewer, String order) {
        Project project = findViewable(projectId, viewer);
        boolean isPublic = PostService.isProjectPublic(project);
        boolean participates = access.roleOf(project, viewer).isPresent();

        Map<Task, List<TaskFile>> byTask = new LinkedHashMap<>();
        fileRepository.findByTask_Project(project).stream()
                .filter(file -> showsInPublicView(file, viewer, isPublic))
                .sorted(Comparator.comparing(TaskFile::getCreatedAt))
                .forEach(file -> byTask.computeIfAbsent(file.getTask(), key -> new ArrayList<>()).add(file));

        List<PublicProjectResponse.Update> updates = new ArrayList<>();
        byTask.forEach((task, files) -> updates.add(new PublicProjectResponse.Update(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getStatus() == TaskStatus.DONE,
                files.get(0).getCreatedAt(),
                files.get(files.size() - 1).getCreatedAt(),
                files.stream().map(file -> new PublicProjectResponse.Image(file.getId(),
                        "/api/v1/projects/" + project.getId() + "/public/files/" + file.getId(),
                        file.isFinalImage(), file.getCreatedAt())).toList())));
        Comparator<PublicProjectResponse.Update> byDate = "desc".equalsIgnoreCase(order)
                ? Comparator.comparing(PublicProjectResponse.Update::lastImageAt).reversed()
                : Comparator.comparing(PublicProjectResponse.Update::firstImageAt);
        updates.sort(byDate);

        List<UserSummary> members = memberRepository.findByProjectOrderByJoinedAtAsc(project).stream()
                .map(member -> UserSummary.from(member.getUser()))
                .toList();
        return new PublicProjectResponse(project.getId(), project.getName(), project.getDescription(),
                project.getType(), project.getStatus(), UserSummary.from(project.getCreatedByUser()), members,
                project.getPublicSince(), isPublic, participates, project.getCoverFileId(), updates);
    }

    @Transactional(readOnly = true)
    public PostService.ImageContent image(Long projectId, Long fileId, User viewerOrNull) {
        Project project = findViewable(projectId, viewerOrNull);
        boolean isPublic = PostService.isProjectPublic(project);
        TaskFile file = fileRepository.findById(fileId)
                .filter(candidate -> candidate.getTask().getProject().getId().equals(project.getId()))
                .filter(candidate -> showsInPublicView(candidate, viewerOrNull, isPublic))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Imagem não encontrada."));
        Resource content = storage.load(file.getStoredName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "O conteúdo da imagem não está mais no servidor."));
        return new PostService.ImageContent(content, file.getContentType(), file.getSizeBytes(), isPublic);
    }

    private Project findViewable(Long projectId, User viewer) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado."));
        if (!PostService.isProjectPublic(project) && access.roleOf(project, viewer).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado.");
        }
        return project;
    }

    private boolean showsInPublicView(TaskFile file, User viewer, boolean projectIsPublic) {
        Task task = file.getTask();
        return TaskFileService.isPreviewableImage(file.getContentType())
                && !task.isHiddenFromPublic()
                && (projectIsPublic || access.canSeeTask(task, viewer));
    }
}
