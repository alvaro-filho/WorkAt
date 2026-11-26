package com.example.backend.services;

import com.example.backend.dto.PostResponse;
import com.example.backend.dto.UserSummary;
import com.example.backend.models.Post;
import com.example.backend.models.PostImage;
import com.example.backend.models.PostKind;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectType;
import com.example.backend.models.Task;
import com.example.backend.models.TaskFile;
import com.example.backend.models.User;
import com.example.backend.repositories.PostImageRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.TaskFileRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Publicações (substituem a antiga vitrine). Duas formas de publicar:
 * - WIP automático: com a opção ligada no projeto, cada imagem enviada numa tarefa vira um WIP
 *   (envios do mesmo autor na mesma tarefa em até 30 min se juntam numa publicação só);
 * - post avulso, estilo X, com ou sem uma imagem de tarefa ligada ("Publicar como post").
 *
 * A visibilidade é sempre calculada na hora (isPublic): projeto que volta a ser privado ou ganha NDA esconde
 * as publicações sem apagá-las.
 */
@Service
public class PostService {

    static final int WIP_GROUP_MINUTES = 30;
    static final int MAX_TITLE = 150;
    static final int MAX_SUBTITLE = 2000;
    static final long MAX_IMAGE_BYTES = 50L * 1024 * 1024;
    static final int MAX_FEED_PAGE = 50;
    static final Map<String, String> IMAGE_TYPES = Map.of(
            "png", "image/png", "jpg", "image/jpeg", "jpeg", "image/jpeg", "webp", "image/webp", "gif", "image/gif");

    private final PostRepository postRepository;
    private final PostImageRepository imageRepository;
    private final TaskFileRepository fileRepository;
    private final ProjectAccessService access;
    private final FileStorage storage;

    public PostService(PostRepository postRepository, PostImageRepository imageRepository,
                       TaskFileRepository fileRepository, ProjectAccessService access, FileStorage storage) {
        this.postRepository = postRepository;
        this.imageRepository = imageRepository;
        this.fileRepository = fileRepository;
        this.access = access;
        this.storage = storage;
    }

    // ---- Regras de visibilidade ----

    /** NDA ativo: corporativo com NDA ligado e sem data de liberação alcançada. */
    public static boolean ndaBlocks(Project project) {
        return project != null && project.getType() == ProjectType.CORPORATE && project.isNdaEnabled()
                && (project.getNdaReleaseDate() == null || project.getNdaReleaseDate().isAfter(LocalDate.now()));
    }

    /** Projeto aberto ao público: WIP automático ligado e sem NDA ativo. */
    public static boolean isProjectPublic(Project project) {
        return project != null && project.isAutoWip() && !ndaBlocks(project);
    }

    /** Espelha a consulta PostRepository.findPublicFeed. */
    public static boolean isPublic(Post post) {
        Project project = post.getProject();
        if (project == null) {
            return true;
        }
        if (post.getKind() == PostKind.STANDALONE) {
            return !ndaBlocks(project);
        }
        return isProjectPublic(project) && (post.getTask() == null || !post.getTask().isHiddenFromPublic());
    }

    public boolean canView(Post post, User viewer) {
        return isPublic(post)
                || ProjectAccessService.sameUser(post.getAuthor(), viewer)
                || (post.getProject() != null && viewer != null && access.roleOf(post.getProject(), viewer).isPresent());
    }

    // ---- Leitura ----

    @Transactional(readOnly = true)
    public List<PostResponse> feed(Long before, Integer limit) {
        int size = limit == null || limit < 1 ? 20 : Math.min(limit, MAX_FEED_PAGE);
        long cursor = before == null ? Long.MAX_VALUE : before;
        return postRepository.findPublicFeed(cursor, LocalDate.now(), PageRequest.of(0, size)).stream()
                .filter(post -> !post.getImages().isEmpty() || post.getKind() == PostKind.PROJECT_PUBLISHED)
                .map(this::toResponse)
                .toList();
    }

    /** Publicações de alguém que o visitante pode ver (o próprio autor vê todas). */
    @Transactional(readOnly = true)
    public List<Post> visibleByAuthor(User author, User viewer) {
        return postRepository.findByAuthorOrderByIdDesc(author).stream()
                .filter(post -> canView(post, viewer))
                .toList();
    }

    /** Publicações do projeto que o visitante pode ver, mais novas primeiro. */
    @Transactional(readOnly = true)
    public List<Post> visibleInProject(Project project, User viewer) {
        return postRepository.findByProjectOrderByIdDesc(project).stream()
                .filter(post -> canView(post, viewer))
                .toList();
    }

    /** Capa de um projeto público: a imagem mais recente das publicações públicas dele. */
    @Transactional(readOnly = true)
    public Optional<String> coverOf(Project project) {
        return postRepository.findByProjectOrderByIdDesc(project).stream()
                .filter(PostService::isPublic)
                .filter(post -> !post.getImages().isEmpty())
                .findFirst()
                .map(post -> imageUrl(post, post.getImages().get(post.getImages().size() - 1)));
    }

    @Transactional(readOnly = true)
    public PostResponse get(Long postId, User viewer) {
        return toResponse(findVisible(postId, viewer));
    }

    @Transactional(readOnly = true)
    public ImageContent image(Long postId, Long imageId, User viewerOrNull) {
        Post post = findVisible(postId, viewerOrNull);
        PostImage image = post.getImages().stream()
                .filter(candidate -> candidate.getId().equals(imageId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Imagem não encontrada."));
        TaskFile file = image.getTaskFile();
        Resource content = storage.load(file != null ? file.getStoredName() : image.getStoredName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "O conteúdo da imagem não está mais no servidor."));
        return new ImageContent(content, file != null ? file.getContentType() : image.getContentType(),
                file != null ? file.getSizeBytes() : image.getSizeBytes(), isPublic(post));
    }

    // ---- Escrita ----

    @Transactional
    public Post createStandalone(User author, MultipartFile file, String title, String subtitle) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escolha uma imagem para publicar.");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "A imagem passa do limite de 50 MB.");
        }
        String extension = TaskFileService.extensionOf(TaskFileService.cleanFileName(file.getOriginalFilename()));
        String contentType = IMAGE_TYPES.get(extension);
        if (contentType == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "A imagem precisa ser PNG, JPG, WEBP ou GIF.");
        }
        Post post = new Post();
        post.setAuthor(author);
        post.setKind(PostKind.STANDALONE);
        post.setTitle(cleanTitle(title));
        post.setSubtitle(cleanSubtitle(subtitle));
        String storedName;
        try {
            storedName = storage.save(file.getInputStream(), extension);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível salvar a imagem.");
        }
        post.addImage(PostImage.ofStored(storedName, contentType, file.getSize()));
        return postRepository.save(post);
    }

    /** "Publicar como post": uma imagem de tarefa vira post avulso, mesmo com o projeto privado (mas não com NDA). */
    @Transactional
    public Post publishTaskFile(Long fileId, User user, String title, String subtitle) {
        TaskFile file = fileRepository.findById(fileId)
                .filter(candidate -> access.canSeeTask(candidate.getTask(), user))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Arquivo não encontrado."));
        Task task = file.getTask();
        access.ensureCanWorkOnTask(task, user);
        if (!TaskFileService.isPreviewableImage(file.getContentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Só imagens PNG, JPG, WEBP ou GIF podem ser publicadas.");
        }
        if (ndaBlocks(task.getProject())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Este projeto está sob NDA: nada dele pode ser publicado antes da data de liberação.");
        }
        Post post = new Post();
        post.setAuthor(user);
        post.setKind(PostKind.STANDALONE);
        post.setProject(task.getProject());
        post.setTask(task);
        String cleanTitle = cleanTitle(title);
        post.setTitle(cleanTitle == null ? task.getTitle() : cleanTitle);
        post.setSubtitle(cleanSubtitle(subtitle));
        post.addImage(PostImage.ofTaskFile(file));
        return postRepository.save(post);
    }

    @Transactional
    public Post update(Long postId, User user, String title, String subtitle, Boolean hiddenFromPortfolio) {
        Post post = findVisible(postId, user);
        if (!ProjectAccessService.sameUser(post.getAuthor(), user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só quem publicou pode editar.");
        }
        if (title != null || subtitle != null) {
            if (post.getKind() != PostKind.STANDALONE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "O título de um WIP vem da tarefa: edite a tarefa.");
            }
            if (title != null) {
                post.setTitle(cleanTitle(title));
            }
            if (subtitle != null) {
                post.setSubtitle(cleanSubtitle(subtitle));
            }
        }
        if (hiddenFromPortfolio != null) {
            post.setHiddenFromPortfolio(hiddenFromPortfolio);
        }
        return postRepository.save(post);
    }

    /** Apaga a publicação. O arquivo da tarefa (se houver) continua no projeto. */
    @Transactional
    public void delete(Long postId, User user) {
        Post post = findVisible(postId, user);
        boolean projectOwner = post.getProject() != null && ProjectAccessService.isOwner(post.getProject(), user);
        if (!ProjectAccessService.sameUser(post.getAuthor(), user) && !projectOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Só quem publicou ou o dono do projeto pode apagar.");
        }
        removePosts(List.of(post));
    }

    /** Chamado depois de salvar um arquivo de tarefa. Só imagem, e só com WIP automático ligado. */
    @Transactional
    public Optional<Post> recordWip(TaskFile file) {
        Task task = file.getTask();
        Project project = task.getProject();
        if (!project.isAutoWip() || task.isHiddenFromPublic()
                || !TaskFileService.isPreviewableImage(file.getContentType())) {
            return Optional.empty();
        }
        LocalDateTime since = LocalDateTime.now().minusMinutes(WIP_GROUP_MINUTES);
        Post post = postRepository
                .findFirstByAuthorAndTaskAndKindAndCreatedAtAfterOrderByIdDesc(file.getUploadedBy(), task,
                        PostKind.WIP, since)
                .orElseGet(() -> {
                    Post created = new Post();
                    created.setAuthor(file.getUploadedBy());
                    created.setKind(PostKind.WIP);
                    created.setProject(project);
                    created.setTask(task);
                    return created;
                });
        post.addImage(PostImage.ofTaskFile(file));
        return Optional.of(postRepository.save(post));
    }

    /**
     * Aviso único "o projeto ficou público", com até 4 imagens recentes do projeto.
     * Não se repete se o dono desligar e ligar de novo.
     */
    @Transactional
    public Optional<Post> recordProjectPublished(Project project, User owner) {
        if (postRepository.existsByProjectAndKind(project, PostKind.PROJECT_PUBLISHED)) {
            return Optional.empty();
        }
        Post post = new Post();
        post.setAuthor(owner);
        post.setKind(PostKind.PROJECT_PUBLISHED);
        post.setProject(project);
        fileRepository.findByTask_Project(project).stream()
                .filter(file -> TaskFileService.isPreviewableImage(file.getContentType()))
                .filter(file -> !file.getTask().isHiddenFromPublic())
                .sorted(Comparator.comparing(TaskFile::getCreatedAt).reversed())
                .limit(4)
                .forEach(file -> post.addImage(PostImage.ofTaskFile(file)));
        return Optional.of(postRepository.save(post));
    }

    /** Arquivos de tarefa apagados saem das publicações; publicação que fica sem imagem some (menos o aviso de projeto). */
    @Transactional
    public void detachTaskFiles(Collection<TaskFile> files) {
        if (files.isEmpty()) {
            return;
        }
        Set<Post> touched = new LinkedHashSet<>();
        for (PostImage image : imageRepository.findByTaskFileIn(files)) {
            Post post = image.getPost();
            post.getImages().remove(image);
            touched.add(post);
        }
        for (Post post : touched) {
            if (post.getImages().isEmpty() && post.getKind() != PostKind.PROJECT_PUBLISHED) {
                postRepository.delete(post);
            } else {
                postRepository.save(post);
            }
        }
        postRepository.flush();
    }

    @Transactional
    public void deleteAllForTask(Task task) {
        removePosts(keepStandalonePosts(postRepository.findByTask(task), task.getProject()));
    }

    @Transactional
    public void deleteAllForProject(Project project) {
        removePosts(keepStandalonePosts(postRepository.findByProject(project), project));
    }

    /**
     * Quando o projeto (ou a tarefa) some, os posts que o artista publicou ficam no portfólio dele:
     * as imagens viram cópias próprias do post e o post se desliga do projeto. WIPs e avisos somem.
     * Com NDA ativo nada é preservado (o post desligado viraria público). Devolve o que deve ser apagado.
     */
    private List<Post> keepStandalonePosts(List<Post> posts, Project project) {
        boolean nda = ndaBlocks(project);
        List<Post> remove = new ArrayList<>();
        for (Post post : posts) {
            if (post.getKind() != PostKind.STANDALONE || nda || !preserve(post)) {
                remove.add(post);
            }
        }
        return remove;
    }

    /** Copia as imagens que ainda apontam para arquivos da tarefa; false se nada sobrou. */
    private boolean preserve(Post post) {
        for (PostImage image : new ArrayList<>(post.getImages())) {
            TaskFile file = image.getTaskFile();
            if (file == null) {
                continue;
            }
            Resource content = storage.load(file.getStoredName()).orElse(null);
            if (content == null) {
                post.getImages().remove(image);
                continue;
            }
            String stored = file.getStoredName();
            String extension = stored.contains(".") ? stored.substring(stored.lastIndexOf('.') + 1) : "bin";
            try (InputStream input = content.getInputStream()) {
                image.setStoredName(storage.save(input, extension));
            } catch (IOException exception) {
                post.getImages().remove(image);
                continue;
            }
            image.setContentType(file.getContentType());
            image.setSizeBytes(file.getSizeBytes());
            image.setTaskFile(null);
        }
        if (post.getImages().isEmpty()) {
            return false;
        }
        post.setProject(null);
        post.setTask(null);
        postRepository.save(post);
        return true;
    }

    // ---- Apoio ----

    public PostResponse toResponse(Post post) {
        Task task = post.getTask();
        Project project = post.getProject();
        String title = post.getTitle() != null ? post.getTitle()
                : task != null ? task.getTitle()
                : project != null ? project.getName() : null;
        String subtitle = post.getSubtitle() != null ? post.getSubtitle()
                : post.getKind() == PostKind.WIP && task != null ? task.getDescription()
                : post.getKind() == PostKind.PROJECT_PUBLISHED && project != null ? project.getDescription() : null;
        return new PostResponse(
                post.getId(),
                post.getKind(),
                labelOf(post),
                title,
                subtitle,
                UserSummary.from(post.getAuthor()),
                project == null ? null
                        : new PostResponse.ProjectRef(project.getId(), project.getName(), project.getType()),
                task == null ? null : new PostResponse.TaskRef(task.getId(), task.getTitle(), task.getStatus()),
                post.getImages().stream()
                        .map(image -> new PostResponse.ImageRef(image.getId(), imageUrl(post, image)))
                        .toList(),
                post.isHiddenFromPortfolio(),
                isPublic(post),
                post.getCreatedAt());
    }

    static String labelOf(Post post) {
        if (post.getKind() == PostKind.PROJECT_PUBLISHED) {
            return null;
        }
        boolean hasFinal = post.getImages().stream()
                .anyMatch(image -> image.getTaskFile() != null && image.getTaskFile().isFinalImage());
        if (hasFinal) {
            return "FINAL";
        }
        return post.getKind() == PostKind.WIP ? "WIP" : null;
    }

    private static String imageUrl(Post post, PostImage image) {
        return "/api/v1/posts/" + post.getId() + "/images/" + image.getId();
    }

    private Post findVisible(Long postId, User viewer) {
        return postRepository.findById(postId)
                .filter(post -> canView(post, viewer))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Publicação não encontrada."));
    }

    private void removePosts(List<Post> posts) {
        if (posts.isEmpty()) {
            return;
        }
        for (Post post : posts) {
            post.getImages().forEach(image -> storage.delete(image.getStoredName()));
        }
        postRepository.deleteAll(posts);
        postRepository.flush();
    }

    private static String cleanTitle(String title) {
        if (title == null || title.isBlank()) {
            return null;
        }
        String clean = title.trim();
        if (clean.length() > MAX_TITLE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O título deve ter no máximo 150 caracteres.");
        }
        return clean;
    }

    private static String cleanSubtitle(String subtitle) {
        if (subtitle == null || subtitle.isBlank()) {
            return null;
        }
        String clean = subtitle.trim();
        if (clean.length() > MAX_SUBTITLE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "O subtítulo deve ter no máximo 2000 caracteres.");
        }
        return clean;
    }

    public record ImageContent(Resource content, String contentType, long sizeBytes, boolean isPublic) {
    }
}
