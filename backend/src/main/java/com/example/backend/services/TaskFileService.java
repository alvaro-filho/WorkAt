package com.example.backend.services;

import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.TaskFile;
import com.example.backend.models.User;
import com.example.backend.repositories.TaskFileRepository;
import com.example.backend.repositories.TaskRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Arquivos das tarefas, guardados em disco no backend (desvio documentado do S3/R2 com URL assinada).
 * Todo acesso passa pela checagem de participação: não existe link público para arquivo privado.
 */
@Service
public class TaskFileService {

    /** Extensões aceitas e o tipo que o servidor devolve. O tipo enviado pelo navegador é ignorado. */
    static final Map<String, String> ALLOWED_TYPES = Map.ofEntries(
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("webp", "image/webp"),
            Map.entry("gif", "image/gif"),
            Map.entry("tif", "image/tiff"),
            Map.entry("tiff", "image/tiff"),
            Map.entry("psd", "application/x-photoshop"),
            Map.entry("kra", "application/x-krita"),
            Map.entry("clip", "application/octet-stream"),
            Map.entry("ai", "application/postscript"),
            Map.entry("blend", "application/x-blender"),
            Map.entry("fbx", "application/octet-stream"),
            Map.entry("obj", "model/obj"),
            Map.entry("zip", "application/zip"),
            Map.entry("pdf", "application/pdf")
    );

    /** Tipos que o navegador consegue mostrar como imagem (preview e imagem final). */
    private static final Set<String> PREVIEWABLE = Set.of("image/png", "image/jpeg", "image/webp", "image/gif");

    private final ProjectAccessService access;
    private final TaskRepository taskRepository;
    private final TaskFileRepository fileRepository;
    private final Path storageDir;
    private final long maxBytes;

    public TaskFileService(ProjectAccessService access, TaskRepository taskRepository,
                           TaskFileRepository fileRepository,
                           @Value("${app.storage.dir:uploads}") String storageDir,
                           @Value("${app.storage.max-file-size-mb:500}") long maxFileSizeMb) {
        this.access = access;
        this.taskRepository = taskRepository;
        this.fileRepository = fileRepository;
        this.storageDir = Path.of(storageDir).toAbsolutePath().normalize();
        this.maxBytes = maxFileSizeMb * 1024 * 1024;
    }

    public static boolean isPreviewableImage(String contentType) {
        return contentType != null && PREVIEWABLE.contains(contentType);
    }

    @Transactional(readOnly = true)
    public List<TaskFile> list(Long taskId, User user) {
        return fileRepository.findByTaskOrderByVersionDesc(findVisibleTask(taskId, user));
    }

    @Transactional
    public TaskFile upload(Long taskId, User user, MultipartFile file, boolean markAsFinal) {
        Task task = findVisibleTask(taskId, user);
        access.ensureCanWorkOnTask(task, user);
        access.ensureActive(task.getProject());

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escolha um arquivo para enviar.");
        }
        if (file.getSize() > maxBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "O arquivo passa do limite de " + (maxBytes / (1024 * 1024)) + " MB.");
        }
        String originalName = cleanFileName(file.getOriginalFilename());
        String extension = extensionOf(originalName);
        String contentType = ALLOWED_TYPES.get(extension);
        if (contentType == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Tipo de arquivo não permitido. Aceitos: "
                            + String.join(", ", ALLOWED_TYPES.keySet().stream().sorted().toList()) + ".");
        }
        if (markAsFinal && !isPreviewableImage(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A imagem final precisa ser PNG, JPG, WEBP ou GIF.");
        }

        String storedName = UUID.randomUUID() + "." + extension;
        try (InputStream input = file.getInputStream()) {
            Files.createDirectories(storageDir);
            Files.copy(input, resolveStored(storedName), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível salvar o arquivo.");
        }

        if (markAsFinal) {
            clearFinal(task);
        }
        TaskFile taskFile = new TaskFile();
        taskFile.setTask(task);
        taskFile.setUploadedBy(user);
        taskFile.setOriginalName(originalName);
        taskFile.setStoredName(storedName);
        taskFile.setContentType(contentType);
        taskFile.setSizeBytes(file.getSize());
        taskFile.setVersion((int) fileRepository.countByTask(task) + 1);
        taskFile.setFinalImage(markAsFinal);
        return fileRepository.save(taskFile);
    }

    /** Arquivo e caminho no disco, para download. Só para quem pode ver a tarefa. */
    @Transactional(readOnly = true)
    public StoredFile load(Long fileId, User user) {
        TaskFile file = findVisibleFile(fileId, user);
        Path path = resolveStored(file.getStoredName());
        if (!Files.exists(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "O conteúdo do arquivo não está mais no servidor.");
        }
        return new StoredFile(file, path);
    }

    @Transactional
    public TaskFile markAsFinal(Long fileId, User user) {
        TaskFile file = findVisibleFile(fileId, user);
        access.ensureCanWorkOnTask(file.getTask(), user);
        access.ensureActive(file.getTask().getProject());
        if (!isPreviewableImage(file.getContentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A imagem final precisa ser PNG, JPG, WEBP ou GIF.");
        }
        clearFinal(file.getTask());
        file.setFinalImage(true);
        return fileRepository.save(file);
    }

    /** Quem enviou ou o dono do projeto pode apagar. */
    @Transactional
    public void delete(Long fileId, User user) {
        TaskFile file = findVisibleFile(fileId, user);
        Project project = file.getTask().getProject();
        if (!ProjectAccessService.sameUser(file.getUploadedBy(), user) && !ProjectAccessService.isOwner(project, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Só quem enviou ou o dono do projeto pode apagar o arquivo.");
        }
        access.ensureActive(project);
        removeFromDisk(file);
        fileRepository.delete(file);
    }

    /** Usado ao apagar a tarefa (a permissão já foi checada por quem chama). */
    @Transactional
    public void deleteAllForTask(Task task) {
        List<TaskFile> files = fileRepository.findByTaskOrderByVersionDesc(task);
        files.forEach(this::removeFromDisk);
        fileRepository.deleteAll(files);
    }

    /** Usado ao apagar o projeto (a permissão já foi checada por quem chama). */
    @Transactional
    public void deleteAllForProject(Project project) {
        List<TaskFile> files = fileRepository.findByTask_Project(project);
        files.forEach(this::removeFromDisk);
        fileRepository.deleteAll(files);
    }

    private void clearFinal(Task task) {
        for (TaskFile other : fileRepository.findByTaskOrderByVersionDesc(task)) {
            if (other.isFinalImage()) {
                other.setFinalImage(false);
                fileRepository.save(other);
            }
        }
    }

    private Task findVisibleTask(Long taskId, User user) {
        return taskRepository.findById(taskId)
                .filter(task -> access.canSeeTask(task, user))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarefa não encontrada."));
    }

    private TaskFile findVisibleFile(Long fileId, User user) {
        return fileRepository.findById(fileId)
                .filter(file -> access.canSeeTask(file.getTask(), user))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Arquivo não encontrado."));
    }

    private Path resolveStored(String storedName) {
        Path path = storageDir.resolve(storedName).normalize();
        if (!path.startsWith(storageDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome de arquivo inválido.");
        }
        return path;
    }

    private void removeFromDisk(TaskFile file) {
        try {
            Files.deleteIfExists(resolveStored(file.getStoredName()));
        } catch (IOException ignored) {
            // O registro sai do banco mesmo assim; um arquivo órfão no disco não expõe nada.
        }
    }

    static String cleanFileName(String name) {
        String base = name == null ? "" : name.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"]", "").trim();
        if (base.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O arquivo precisa ter um nome.");
        }
        return base.length() > 200 ? base.substring(base.length() - 200) : base;
    }

    static String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public record StoredFile(TaskFile file, Path path) {
    }
}
