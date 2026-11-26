package com.example.backend.services;

import com.example.backend.dto.TaskCreateRequest;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectHistory;
import com.example.backend.models.ProjectType;
import com.example.backend.models.Task;
import com.example.backend.models.TaskFile;
import com.example.backend.models.TaskPriority;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectHistoryRepository;
import com.example.backend.repositories.TaskFileRepository;
import com.example.backend.repositories.TaskRepository;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Histórico do projeto, modelos de projeto e o .zip com as imagens finais. */
@Service
public class ProjectExtrasService {

    private final ProjectAccessService access;
    private final ProjectHistoryRepository historyRepository;
    private final TaskRepository taskRepository;
    private final TaskFileRepository fileRepository;
    private final TaskService taskService;
    private final FileStorage storage;

    public ProjectExtrasService(ProjectAccessService access, ProjectHistoryRepository historyRepository,
                                TaskRepository taskRepository, TaskFileRepository fileRepository,
                                TaskService taskService, FileStorage storage) {
        this.access = access;
        this.historyRepository = historyRepository;
        this.taskRepository = taskRepository;
        this.fileRepository = fileRepository;
        this.taskService = taskService;
        this.storage = storage;
    }

    // ---- Histórico ----

    /** As 200 últimas ações. No corporativo, o contratado não vê o que acontece em tarefas que não enxerga. */
    @Transactional(readOnly = true)
    public List<ProjectHistory> history(Long projectId, User user) {
        Project project = access.requireParticipant(projectId, user);
        List<ProjectHistory> rows = historyRepository.findByProjectOrderByIdDesc(project, PageRequest.of(0, 200));
        if (ProjectAccessService.isOwner(project, user) || project.getType() != ProjectType.CORPORATE) {
            return rows;
        }
        Set<Long> visible = taskRepository.findByProjectOrderByCreatedAtAsc(project).stream()
                .filter(task -> access.canSeeTask(task, user))
                .map(Task::getId)
                .collect(Collectors.toCollection(HashSet::new));
        return rows.stream().filter(row -> row.getTaskId() == null || visible.contains(row.getTaskId())).toList();
    }

    // ---- Modelos ----

    public record TemplateTask(String title, String description, TaskPriority priority) {
    }

    public record ProjectTemplate(String id, String name, String description, List<TemplateTask> tasks) {
    }

    public static final List<ProjectTemplate> TEMPLATES = List.of(
            new ProjectTemplate("concept-personagem", "Concept de personagem",
                    "Do briefing ao turnaround final.", List.of(
                    new TemplateTask("Briefing e referências", "Juntar referências no Canvas e alinhar o briefing.", TaskPriority.HIGH),
                    new TemplateTask("Thumbnails de silhueta", "Explorar silhuetas rápidas.", TaskPriority.MEDIUM),
                    new TemplateTask("Estudos de cor", "Paletas e variações de cor.", TaskPriority.MEDIUM),
                    new TemplateTask("Arte final", "Ilustração final do personagem.", TaskPriority.HIGH),
                    new TemplateTask("Turnaround", "Vistas de frente, lado e costas.", TaskPriority.LOW))),
            new ProjectTemplate("ilustracao", "Ilustração",
                    "Uma peça do esboço ao acabamento.", List.of(
                    new TemplateTask("Esboço e composição", "Composição e enquadramento.", TaskPriority.HIGH),
                    new TemplateTask("Line art", "Linhas limpas sobre o esboço aprovado.", TaskPriority.MEDIUM),
                    new TemplateTask("Cor e iluminação", "Cores base, luz e sombra.", TaskPriority.MEDIUM),
                    new TemplateTask("Acabamento e entrega", "Ajustes finais e exportação.", TaskPriority.HIGH))),
            new ProjectTemplate("hq-capitulo", "Capítulo de HQ",
                    "Roteiro, páginas e capa de um capítulo.", List.of(
                    new TemplateTask("Roteiro", "Texto do capítulo e divisão em páginas.", TaskPriority.HIGH),
                    new TemplateTask("Storyboard das páginas", "Layout dos quadros.", TaskPriority.HIGH),
                    new TemplateTask("Arte das páginas", "Lápis, arte-final e cor.", TaskPriority.MEDIUM),
                    new TemplateTask("Balões e letreiramento", "Texto nos balões.", TaskPriority.MEDIUM),
                    new TemplateTask("Capa", "Ilustração da capa.", TaskPriority.LOW))));

    public static ProjectTemplate template(String id) {
        if (id == null || id.isBlank()) {
            return null;
        }
        return TEMPLATES.stream().filter(t -> t.id().equals(id)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Modelo de projeto desconhecido."));
    }

    /** Cria as tarefas do modelo no projeto recém-criado (pelo dono). */
    @Transactional
    public void applyTemplate(Project project, User owner, String templateId) {
        ProjectTemplate template = template(templateId);
        if (template == null) {
            return;
        }
        for (TemplateTask item : template.tasks()) {
            TaskCreateRequest request = new TaskCreateRequest();
            request.setTitle(item.title());
            request.setDescription(item.description());
            request.setPriority(item.priority());
            taskService.createTask(project.getId(), owner, request);
        }
    }

    // ---- .zip das finais ----

    /** Imagens finais das tarefas que o usuário pode ver. Vazio = 404 (nada para baixar). */
    @Transactional(readOnly = true)
    public FinalsArchive finals(Long projectId, User user) {
        Project project = access.requireParticipant(projectId, user);
        List<TaskFile> finals = new ArrayList<>();
        for (Task task : taskRepository.findByProjectOrderByCreatedAtAsc(project)) {
            if (!access.canSeeTask(task, user)) {
                continue;
            }
            fileRepository.findByTaskOrderByVersionDesc(task).stream()
                    .filter(TaskFile::isFinalImage)
                    .findFirst()
                    .ifPresent(finals::add);
        }
        if (finals.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Nenhuma tarefa tem imagem final ainda.");
        }
        Set<String> used = new HashSet<>();
        List<ZipItem> items = finals.stream()
                .map(file -> new ZipItem(file.getStoredName(),
                        uniqueName(used, slug(file.getTask().getTitle()) + "-" + file.getOriginalName())))
                .toList();
        return new FinalsArchive(slug(project.getName()) + "-finais.zip", items);
    }

    /** Só nomes, sem entidades: o .zip é escrito fora da transação. */
    public record ZipItem(String storedName, String entryName) {
    }

    public record FinalsArchive(String fileName, List<ZipItem> items) {
    }

    /** Escreve o .zip direto na resposta, um arquivo por vez (sem montar tudo na memória). */
    public void writeZip(FinalsArchive archive, OutputStream out) throws IOException {
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (ZipItem item : archive.items()) {
                Resource content = storage.load(item.storedName()).orElse(null);
                if (content == null) {
                    continue; // Arquivo que sumiu do armazenamento não derruba o resto.
                }
                zip.putNextEntry(new ZipEntry(item.entryName()));
                try (InputStream input = content.getInputStream()) {
                    input.transferTo(zip);
                }
                zip.closeEntry();
            }
        }
    }

    private static String uniqueName(Set<String> used, String name) {
        String candidate = name;
        int n = 2;
        while (!used.add(candidate)) {
            int dot = name.lastIndexOf('.');
            candidate = dot < 0 ? name + "-" + n : name.substring(0, dot) + "-" + n + name.substring(dot);
            n++;
        }
        return candidate;
    }

    static String slug(String text) {
        String base = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9.]+", "-")
                .replaceAll("^-|-$", "");
        return base.isEmpty() ? "arquivo" : base;
    }
}
