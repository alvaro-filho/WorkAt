package com.example.backend.services;

import com.example.backend.models.NdaStatus;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectType;
import com.example.backend.models.ShowcaseArt;
import com.example.backend.models.Task;
import com.example.backend.models.TaskFile;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.ShowcaseArtRepository;
import com.example.backend.repositories.TaskFileRepository;
import com.example.backend.repositories.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ShowcaseSubmissionServiceTest {
    private TaskFileRepository fileRepository;
    private ShowcaseArtRepository artRepository;
    private ShowcaseSubmissionService service;

    private User owner;
    private User contractor;
    private Project project;
    private Task task;
    private TaskFile finalImage;

    @BeforeEach
    void setUp() {
        ProjectRepository projectRepository = mock(ProjectRepository.class);
        ProjectMemberRepository memberRepository = mock(ProjectMemberRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        fileRepository = mock(TaskFileRepository.class);
        artRepository = mock(ShowcaseArtRepository.class);
        service = new ShowcaseSubmissionService(new ProjectAccessService(projectRepository, memberRepository),
                taskRepository, fileRepository, artRepository, mock(TaskFileService.class));

        owner = user(1L, "Estúdio");
        contractor = user(2L, "Artista");
        project = new Project();
        project.setId(3L);
        project.setName("Jogo");
        project.setCreatedByUser(owner);
        project.setType(ProjectType.CORPORATE);
        task = new Task();
        task.setId(4L);
        task.setTitle("Concept");
        task.setProject(project);
        task.setAssignee(contractor);
        finalImage = new TaskFile();
        finalImage.setId(5L);
        finalImage.setTask(task);
        finalImage.setFinalImage(true);
        finalImage.setContentType("image/png");

        when(projectRepository.findById(3L)).thenReturn(Optional.of(project));
        when(taskRepository.findById(4L)).thenReturn(Optional.of(task));
        when(memberRepository.existsByProjectAndUser(project, contractor)).thenReturn(true);
        when(fileRepository.findByTaskOrderByVersionDesc(task)).thenReturn(List.of(finalImage));
        when(artRepository.findFirstByTask(task)).thenReturn(Optional.empty());
        when(artRepository.save(any(ShowcaseArt.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void withNdaTheArtIsLockedAndTheContractingPartyIsTheProjectOwner() {
        project.setNdaEnabled(true);

        ShowcaseArt art = service.submitFromTask(4L, contractor, "  Heroína  ", "Pose final");

        assertEquals(NdaStatus.LOCKED_BY_NDA, art.getNdaStatus());
        assertEquals("Heroína", art.getTitle());
        assertSame(contractor, art.getArtist());
        assertSame(owner, art.getCompany());
        assertSame(finalImage, art.getSourceFile());
        assertFalse(ShowcaseSubmissionService.isPublic(art));
        assertNull(art.getApprovedAt());
    }

    @Test
    void withoutNdaTheArtIsPublishedRightAwayUsingTheTaskTitle() {
        ShowcaseArt art = service.submitFromTask(4L, contractor, " ", null);

        assertEquals(NdaStatus.APPROVED_FOR_RELEASE, art.getNdaStatus());
        assertEquals("Concept", art.getTitle());
        assertTrue(ShowcaseSubmissionService.isPublic(art));
        assertNotNull(art.getApprovedAt());
        assertEquals(art.getApprovedAt(), art.getPublishedAt());
    }

    @Test
    void needsAFinalImage() {
        finalImage.setFinalImage(false);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.submitFromTask(4L, contractor, null, null));

        assertEquals(400, exception.getStatusCode().value());
    }

    @Test
    void contractorCannotSubmitSomeoneElsesTask() {
        task.setAssignee(owner);
        project.setContractorsSeeAllTasks(true);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.submitFromTask(4L, contractor, null, null));

        assertEquals(403, exception.getStatusCode().value());
    }

    @Test
    void resubmittingAfterRejectionReusesTheArtAndClearsTheNote() {
        project.setNdaEnabled(true);
        ShowcaseArt rejected = new ShowcaseArt();
        rejected.setId(9L);
        rejected.setNdaStatus(NdaStatus.LOCKED_BY_NDA);
        rejected.setReviewNote("Espere o trailer");
        when(artRepository.findFirstByTask(task)).thenReturn(Optional.of(rejected));

        ShowcaseArt art = service.submitFromTask(4L, contractor, "v2", null);

        assertSame(rejected, art);
        assertNull(art.getReviewNote());
        assertEquals(NdaStatus.LOCKED_BY_NDA, art.getNdaStatus());
    }

    @Test
    void ownerSeesAllProjectArtsAndMemberOnlyTheirs() {
        ShowcaseArt mine = art(contractor);
        ShowcaseArt other = art(owner);
        when(artRepository.findByProjectOrderByCreatedAtDesc(project)).thenReturn(List.of(mine, other));

        assertEquals(2, service.forProject(3L, owner).size());
        assertEquals(List.of(mine), service.forProject(3L, contractor));
    }

    @Test
    void futureReleaseDateIsNotPublicYet() {
        ShowcaseArt art = art(contractor);
        art.setNdaStatus(NdaStatus.APPROVED_FOR_RELEASE);
        art.setReleaseDate(LocalDate.now().plusDays(3));

        assertFalse(ShowcaseSubmissionService.isPublic(art));
        art.setReleaseDate(LocalDate.now());
        assertTrue(ShowcaseSubmissionService.isPublic(art));
    }

    @Test
    void lockedImageIsHiddenFromStrangers() {
        ShowcaseArt art = art(contractor);
        art.setId(20L);
        art.setSourceFile(finalImage);
        art.setNdaStatus(NdaStatus.LOCKED_BY_NDA);
        when(artRepository.findById(20L)).thenReturn(Optional.of(art));

        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.image(20L, null))
                .getStatusCode().value());
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.image(20L, user(99L, "X")))
                .getStatusCode().value());
    }

    private ShowcaseArt art(User artist) {
        ShowcaseArt art = new ShowcaseArt();
        art.setArtist(artist);
        art.setCompany(owner);
        art.setProject(project);
        return art;
    }

    private static User user(Long id, String name) {
        User user = new User();
        user.setId(id);
        user.setFullName(name);
        return user;
    }
}
