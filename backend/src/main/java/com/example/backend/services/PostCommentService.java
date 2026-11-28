package com.example.backend.services;

import com.example.backend.dto.CommentThreadResponse;
import com.example.backend.dto.UserSummary;
import com.example.backend.models.Notification;
import com.example.backend.models.Post;
import com.example.backend.models.PostComment;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectType;
import com.example.backend.models.User;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.PostCommentRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.ProjectRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Comentários de feedback em publicações e na página pública dos projetos.
 * - Comenta quem está logado e consegue ver a publicação (NDA e privado continuam fechados para quem é de fora).
 * - Publicação: o autor liga/desliga. Projeto: o diretor. Em projetos corporativos começam desligados.
 * - Apaga quem escreveu, o autor da publicação ou o diretor do projeto.
 * - Até 30 comentários por hora por pessoa (anti-spam).
 */
@Service
public class PostCommentService {

    static final int MAX_PER_HOUR = 30;

    private final PostCommentRepository commentRepository;
    private final PostRepository postRepository;
    private final ProjectRepository projectRepository;
    private final PostService postService;
    private final ProjectAccessService access;
    private final NotificationRepository notificationRepository;

    public PostCommentService(PostCommentRepository commentRepository, PostRepository postRepository,
                              ProjectRepository projectRepository, PostService postService,
                              ProjectAccessService access, NotificationRepository notificationRepository) {
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.projectRepository = projectRepository;
        this.postService = postService;
        this.access = access;
        this.notificationRepository = notificationRepository;
    }

    // ---- Ligado ou desligado ----

    /** Projeto: valor escolhido pelo diretor; sem escolha, desligado no corporativo e ligado nos outros. */
    public static boolean projectCommentsOn(Project project) {
        if (project.getCommentsEnabled() != null) {
            return project.getCommentsEnabled();
        }
        return project.getType() != ProjectType.CORPORATE;
    }

    /** Publicação: valor escolhido pelo autor; sem escolha, segue o projeto dela (avulsa sem projeto: ligado). */
    public static boolean postCommentsOn(Post post) {
        if (post.getCommentsEnabled() != null) {
            return post.getCommentsEnabled();
        }
        return post.getProject() == null || projectCommentsOn(post.getProject());
    }

    // ---- Publicação ----

    @Transactional(readOnly = true)
    public CommentThreadResponse threadForPost(Long postId, User viewer) {
        Post post = visiblePost(postId, viewer);
        boolean canToggle = viewer != null && ProjectAccessService.sameUser(post.getAuthor(), viewer);
        return thread(commentRepository.findByPostOrderByIdAsc(post), postCommentsOn(post), canToggle,
                comment -> canDeleteOnPost(comment, post, viewer));
    }

    @Transactional
    public CommentThreadResponse addToPost(Long postId, User user, String body, Long parentId) {
        Post post = visiblePost(postId, user);
        if (!postCommentsOn(post)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Os comentários desta publicação estão desligados.");
        }
        PostComment comment = newComment(user, body, parentId, post, null);
        comment.setPost(post);
        commentRepository.save(comment);
        String title = post.getTitle() != null ? "“" + post.getTitle() + "”" : "sua publicação";
        notifyAll(comment, post.getAuthor(), user.getFullName() + " comentou em " + title + ": " + shortBody(comment),
                "/publicacao/" + post.getId());
        return threadForPost(postId, user);
    }

    /** O autor liga ou desliga os comentários da publicação. */
    @Transactional
    public CommentThreadResponse setPostComments(Long postId, User user, boolean enabled) {
        Post post = visiblePost(postId, user);
        if (!ProjectAccessService.sameUser(post.getAuthor(), user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só quem publicou liga ou desliga os comentários.");
        }
        post.setCommentsEnabled(enabled);
        postRepository.save(post);
        return threadForPost(postId, user);
    }

    // ---- Projeto (página pública) ----

    @Transactional(readOnly = true)
    public CommentThreadResponse threadForProject(Long projectId, User viewer) {
        Project project = viewableProject(projectId, viewer);
        boolean canToggle = viewer != null && ProjectAccessService.isOwner(project, viewer);
        return thread(commentRepository.findByProjectOrderByIdAsc(project),
                projectCommentsOn(project) && PostService.isProjectPublic(project), canToggle,
                comment -> canDeleteOnProject(comment, project, viewer));
    }

    @Transactional
    public CommentThreadResponse addToProject(Long projectId, User user, String body, Long parentId) {
        Project project = viewableProject(projectId, user);
        if (!PostService.isProjectPublic(project)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Só projetos abertos ao público recebem comentários.");
        }
        if (!projectCommentsOn(project)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Os comentários deste projeto estão desligados.");
        }
        PostComment comment = newComment(user, body, parentId, null, project);
        comment.setProject(project);
        commentRepository.save(comment);
        notifyAll(comment, project.getCreatedByUser(), user.getFullName() + " comentou no projeto " + project.getName()
                + ": " + shortBody(comment), "/projetos/" + project.getId() + "/publico");
        return threadForProject(projectId, user);
    }

    /** O diretor liga ou desliga os comentários da página do projeto (e das publicações que seguem o projeto). */
    @Transactional
    public CommentThreadResponse setProjectComments(Long projectId, User user, boolean enabled) {
        Project project = access.requireOwner(projectId, user);
        project.setCommentsEnabled(enabled);
        projectRepository.save(project);
        return threadForProject(projectId, user);
    }

    // ---- Apagar ----

    @Transactional
    public void delete(Long commentId, User user) {
        PostComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comentário não encontrado."));
        boolean allowed = comment.getPost() != null
                ? postService.canView(comment.getPost(), user) && canDeleteOnPost(comment, comment.getPost(), user)
                : canDeleteOnProject(comment, comment.getProject(), user);
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Só quem escreveu, o autor da publicação ou o diretor do projeto apaga o comentário.");
        }
        PostComment parent = comment.getParent();
        if (commentRepository.existsByParent(comment)) {
            // Tem respostas: fica "Comentário removido" para a conversa não perder o sentido.
            comment.setRemoved(true);
            comment.setBody("");
            commentRepository.save(comment);
            return;
        }
        commentRepository.delete(comment);
        commentRepository.flush();
        // A última resposta de um comentário já removido leva o comentário junto.
        if (parent != null && parent.isRemoved() && !commentRepository.existsByParent(parent)) {
            commentRepository.delete(parent);
        }
    }

    // ---- Regras internas ----

    private Post visiblePost(Long postId, User viewer) {
        return postRepository.findById(postId)
                .filter(post -> postService.canView(post, viewer))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Publicação não encontrada."));
    }

    private Project viewableProject(Long projectId, User viewer) {
        return projectRepository.findById(projectId)
                .filter(project -> PostService.isProjectPublic(project) || access.roleOf(project, viewer).isPresent())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado."));
    }

    private PostComment newComment(User user, String body, Long parentId, Post post, Project project) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Entre para comentar.");
        }
        String text = body == null ? "" : body.trim();
        if (text.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escreva o comentário.");
        }
        if (text.length() > PostComment.MAX_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "O comentário pode ter até " + PostComment.MAX_LENGTH + " caracteres.");
        }
        if (commentRepository.countByAuthorAndCreatedAtAfter(user, LocalDateTime.now().minusHours(1)) >= MAX_PER_HOUR) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Muitos comentários em pouco tempo. Espere um pouco e tente de novo.");
        }
        PostComment comment = new PostComment();
        comment.setAuthor(user);
        comment.setBody(text);
        if (parentId != null) {
            PostComment parent = commentRepository.findById(parentId)
                    .filter(found -> post != null ? found.getPost() != null && found.getPost().getId().equals(post.getId())
                            : found.getProject() != null && found.getProject().getId().equals(project.getId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comentário não encontrado."));
            if (parent.getParent() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Responda ao comentário principal.");
            }
            if (parent.isRemoved()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Esse comentário foi removido.");
            }
            comment.setParent(parent);
        }
        return comment;
    }

    private boolean canDeleteOnPost(PostComment comment, Post post, User viewer) {
        if (viewer == null || comment.isRemoved()) {
            return false;
        }
        return ProjectAccessService.sameUser(comment.getAuthor(), viewer)
                || ProjectAccessService.sameUser(post.getAuthor(), viewer)
                || (post.getProject() != null && ProjectAccessService.isOwner(post.getProject(), viewer));
    }

    private boolean canDeleteOnProject(PostComment comment, Project project, User viewer) {
        if (viewer == null || comment.isRemoved()) {
            return false;
        }
        return ProjectAccessService.sameUser(comment.getAuthor(), viewer) || ProjectAccessService.isOwner(project, viewer);
    }

    private interface DeleteRule {
        boolean test(PostComment comment);
    }

    private CommentThreadResponse thread(List<PostComment> all, boolean enabled, boolean canToggle, DeleteRule canDelete) {
        Map<Long, List<CommentThreadResponse.Comment>> replies = new LinkedHashMap<>();
        for (PostComment comment : all) {
            if (comment.getParent() != null) {
                replies.computeIfAbsent(comment.getParent().getId(), key -> new ArrayList<>())
                        .add(toResponse(comment, canDelete, List.of()));
            }
        }
        List<CommentThreadResponse.Comment> top = new ArrayList<>();
        for (PostComment comment : all) {
            if (comment.getParent() == null) {
                top.add(toResponse(comment, canDelete, replies.getOrDefault(comment.getId(), List.of())));
            }
        }
        int count = (int) all.stream().filter(comment -> !hidden(comment)).count();
        return new CommentThreadResponse(enabled, canToggle, count, top);
    }

    private static CommentThreadResponse.Comment toResponse(PostComment comment, DeleteRule canDelete,
                                                            List<CommentThreadResponse.Comment> replies) {
        boolean hidden = hidden(comment);
        return new CommentThreadResponse.Comment(comment.getId(),
                hidden ? null : UserSummary.from(comment.getAuthor()),
                hidden ? null : comment.getBody(), hidden, comment.getCreatedAt(),
                !hidden && canDelete.test(comment), replies);
    }

    /** Removido, ou de conta suspensa ou banida: aparece como "Comentário removido". */
    private static boolean hidden(PostComment comment) {
        return comment.isRemoved() || (comment.getAuthor() != null && comment.getAuthor().isBlocked());
    }

    /** Avisa o dono da publicação/projeto e, numa resposta, quem fez o comentário respondido (nunca a si mesmo). */
    private void notifyAll(PostComment comment, User owner, String ownerMessage, String link) {
        User actor = comment.getAuthor();
        User parentAuthor = comment.getParent() == null ? null : comment.getParent().getAuthor();
        if (parentAuthor != null && !ProjectAccessService.sameUser(parentAuthor, actor)) {
            send(parentAuthor, "COMMENT_REPLY", actor.getFullName() + " respondeu ao seu comentário: " + shortBody(comment), link);
        }
        if (owner != null && !ProjectAccessService.sameUser(owner, actor)
                && !ProjectAccessService.sameUser(owner, parentAuthor)) {
            send(owner, "POST_COMMENT", ownerMessage, link);
        }
    }

    private void send(User to, String type, String message, String link) {
        Notification notification = new Notification();
        notification.setUser(to);
        notification.setType(type);
        notification.setMessage(message.length() > 480 ? message.substring(0, 477) + "..." : message);
        notification.setLink(link);
        notificationRepository.save(notification);
    }

    private static String shortBody(PostComment comment) {
        String body = comment.getBody();
        return "“" + (body.length() > 80 ? body.substring(0, 77) + "..." : body) + "”";
    }
}
