package com.example.backend.services;

import com.example.backend.dto.HeatmapDTO;
import com.example.backend.dto.ProfileResponse;
import com.example.backend.dto.PostResponse;
import com.example.backend.dto.UserSummary;
import com.example.backend.models.Post;
import com.example.backend.models.PostKind;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectRole;
import com.example.backend.models.ProjectType;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

/**
 * Perfil estilo GitHub: portfólio (projetos públicos + posts avulsos), posts, projetos e gráfico de atividade.
 *
 * Regras de exibição para quem visita o perfil de outra pessoa:
 * - projeto público (WIP automático, sem NDA ativo) aparece normalmente, com capa;
 * - projetos pessoais privados aparecem só como contagem;
 * - cooperativos aparecem normalmente;
 * - corporativos com NDA ativo aparecem mascarados ("projeto sob NDA para X"), a menos que o visitante participe dele.
 * O próprio dono do perfil vê tudo.
 */
@Service
public class ProfileService {

    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final ProjectAccessService access;
    private final PostService postService;
    private final ActivityEventService activityEventService;

    public ProfileService(UserRepository userRepository, ProjectService projectService, ProjectAccessService access,
                          PostService postService, ActivityEventService activityEventService) {
        this.userRepository = userRepository;
        this.projectService = projectService;
        this.access = access;
        this.postService = postService;
        this.activityEventService = activityEventService;
    }

    @Transactional(readOnly = true)
    public ProfileResponse profile(String username, User viewer) {
        User owner = userRepository.findByUsername(username).filter(found -> !found.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Perfil não encontrado."));
        boolean me = ProjectAccessService.sameUser(owner, viewer);

        List<ProfileResponse.ProfileProject> projects = new ArrayList<>();
        int hiddenPersonal = 0;
        for (Project project : projectService.findProjectsForUser(owner)) {
            ProjectRole ownerRole = ProjectAccessService.isOwner(project, owner) ? ProjectRole.OWNER : ProjectRole.MEMBER;
            boolean viewerParticipates = me || access.roleOf(project, viewer).isPresent();
            boolean nda = PostService.ndaBlocks(project);
            boolean publicView = PostService.isProjectPublic(project);

            if (project.getType() == ProjectType.PERSONAL && !viewerParticipates && !publicView) {
                hiddenPersonal++;
                continue;
            }
            if (nda && !viewerParticipates) {
                projects.add(ProfileResponse.ProfileProject.masked(project.getType(), ownerRole, project.getStatus(),
                        project.getCreatedByUser() == null ? null : project.getCreatedByUser().getFullName()));
                continue;
            }
            projects.add(new ProfileResponse.ProfileProject(project.getId(), project.getName(), project.getDescription(),
                    project.getType(), ownerRole, project.getStatus(), nda, false,
                    project.getCreatedByUser() == null ? null : project.getCreatedByUser().getFullName(),
                    publicView, publicView ? postService.coverOf(project).orElse(null) : null,
                    publicView ? postService.lastPublicActivity(project).orElse(project.getPublicSince()) : null));
        }

        List<Post> visiblePosts = postService.visibleByAuthor(owner, viewer);
        List<PostResponse> posts = postService.toResponses(visiblePosts, viewer);
        List<PostResponse> portfolio = posts.stream()
                .filter(post -> post.kind() == PostKind.STANDALONE && !post.hiddenFromPortfolio())
                .filter(post -> !post.images().isEmpty())
                .toList();
        var repostEntries = postService.reactedBy(owner, com.example.backend.models.PostReaction.Type.REPOST, viewer);
        List<PostResponse> repostResponses = postService.toResponses(
                repostEntries.stream().map(java.util.Map.Entry::getKey).toList(), viewer);
        List<ProfileResponse.Repost> reposts = new ArrayList<>();
        for (int index = 0; index < repostEntries.size(); index++) {
            reposts.add(new ProfileResponse.Repost(repostResponses.get(index), repostEntries.get(index).getValue()));
        }
        List<PostResponse> saved = me
                ? postService.toResponses(postService.reactedBy(owner, com.example.backend.models.PostReaction.Type.SAVE, viewer)
                        .stream().map(java.util.Map.Entry::getKey).toList(), viewer)
                : List.of();
        List<HeatmapDTO> heatmap = activityEventService.getHeatmap(owner.getId());

        return new ProfileResponse(UserSummary.from(owner), me, owner.getCreatedAt(), portfolio, posts, projects,
                hiddenPersonal, heatmap, owner.getBio(), ProfileResponse.split(owner.getSpecialties(), ","),
                ProfileResponse.split(owner.getLinks(), "\n"), owner.bannerUrl(), reposts, saved,
                owner.getRole() == com.example.backend.models.Role.ARTIST
                        ? com.example.backend.dto.ArtistDtos.Availability.publicOf(owner) : null);
    }
}
