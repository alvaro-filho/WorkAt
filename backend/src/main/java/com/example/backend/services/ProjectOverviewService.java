package com.example.backend.services;

import com.example.backend.config.BusinessTime;
import com.example.backend.dto.ProjectOverview;
import com.example.backend.dto.ProjectResponse;
import com.example.backend.dto.UserSummary;
import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.TaskFile;
import com.example.backend.models.TaskStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.TaskFileRepository;
import com.example.backend.repositories.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Resumo dos projetos de alguém para a tela Projetos (progresso, atrasos, equipe e capa). */
@Service
public class ProjectOverviewService {

    private final ProjectService projectService;
    private final ProjectAccessService access;
    private final TaskRepository taskRepository;
    private final TaskFileRepository fileRepository;
    private final ProjectMemberRepository memberRepository;

    public ProjectOverviewService(ProjectService projectService, ProjectAccessService access,
                                  TaskRepository taskRepository, TaskFileRepository fileRepository,
                                  ProjectMemberRepository memberRepository) {
        this.projectService = projectService;
        this.access = access;
        this.taskRepository = taskRepository;
        this.fileRepository = fileRepository;
        this.memberRepository = memberRepository;
    }

    @Transactional(readOnly = true)
    public List<ProjectOverview> overview(User user) {
        LocalDate today = BusinessTime.today();
        List<ProjectOverview> result = new ArrayList<>();
        for (Project project : projectService.findProjectsForUser(user)) {
            List<Task> tasks = taskRepository.findByProjectOrderByCreatedAtAsc(project).stream()
                    .filter(task -> access.canSeeTask(task, user))
                    .toList();
            int done = (int) tasks.stream().filter(task -> task.getStatus() == TaskStatus.DONE).count();
            int review = (int) tasks.stream().filter(task -> task.getStatus() == TaskStatus.REVIEW).count();
            int overdue = (int) tasks.stream()
                    .filter(task -> task.getStatus() != TaskStatus.DONE && task.getDeadline() != null
                            && task.getDeadline().isBefore(today))
                    .count();
            int mine = (int) tasks.stream()
                    .filter(task -> task.getStatus() != TaskStatus.DONE
                            && ProjectAccessService.sameUser(task.getAssignee(), user))
                    .count();

            List<UserSummary> people = new ArrayList<>();
            if (project.getCreatedByUser() != null) {
                people.add(UserSummary.from(project.getCreatedByUser()));
            }
            var members = memberRepository.findByProjectOrderByJoinedAtAsc(project);
            members.stream().limit(4).forEach(member -> people.add(UserSummary.from(member.getUser())));

            List<TaskFile> images = fileRepository.findByTask_Project(project).stream()
                    .filter(file -> TaskFileService.isPreviewableImage(file.getContentType()))
                    .filter(file -> access.canSeeTask(file.getTask(), user))
                    .sorted(Comparator.comparing(TaskFile::getCreatedAt).reversed())
                    .toList();
            Long cover = Optional.ofNullable(project.getCoverFileId())
                    .filter(id -> images.stream().anyMatch(file -> file.getId().equals(id)))
                    .orElse(images.isEmpty() ? null : images.get(0).getId());

            LocalDateTime lastActivity = tasks.stream()
                    .map(Task::getUpdatedAt)
                    .filter(Objects::nonNull)
                    .max(Comparator.naturalOrder())
                    .orElse(null);
            if (!images.isEmpty() && (lastActivity == null || images.get(0).getCreatedAt().isAfter(lastActivity))) {
                lastActivity = images.get(0).getCreatedAt();
            }

            result.add(new ProjectOverview(ProjectResponse.from(project, user), tasks.size(), done, review, overdue,
                    mine, 1 + members.size(), people, cover, lastActivity));
        }
        result.sort(Comparator.comparing(ProjectOverview::lastActivityAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return result;
    }
}
