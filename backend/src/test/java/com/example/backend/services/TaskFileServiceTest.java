package com.example.backend.services;

import com.example.backend.models.Project;
import com.example.backend.models.ProjectType;
import com.example.backend.models.Task;
import com.example.backend.models.TaskFile;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskFileRepository;
import com.example.backend.repositories.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TaskFileServiceTest {
    @TempDir
    Path storage;

    private TaskFileRepository fileRepository;
    private ProjectMemberRepository memberRepository;
    private TaskFileService service;
    private final List<TaskFile> saved = new ArrayList<>();

    private User owner;
    private User contractor;
    private Project project;
    private Task task;

    @BeforeEach
    void setUp() {
        ProjectRepository projectRepository = mock(ProjectRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        memberRepository = mock(ProjectMemberRepository.class);
        fileRepository = mock(TaskFileRepository.class);
        service = new TaskFileService(new ProjectAccessService(projectRepository, memberRepository),
                taskRepository, fileRepository, mock(PostService.class),
                new FileStorage(storage.toString()), 1);

        owner = user(1L);
        contractor = user(2L);
        project = new Project();
        project.setId(5L);
        project.setCreatedByUser(owner);
        project.setType(ProjectType.CORPORATE);
        task = new Task();
        task.setId(9L);
        task.setProject(project);

        when(taskRepository.findById(9L)).thenReturn(Optional.of(task));
        when(memberRepository.existsByProjectAndUser(project, contractor)).thenReturn(true);
        when(fileRepository.save(any(TaskFile.class))).thenAnswer(invocation -> {
            TaskFile file = invocation.getArgument(0);
            if (!saved.contains(file)) saved.add(file);
            return file;
        });
        when(fileRepository.findByTaskOrderByVersionDesc(task)).thenAnswer(invocation -> List.copyOf(saved));
        when(fileRepository.countByTask(task)).thenAnswer(invocation -> (long) saved.size());
    }

    @Test
    void assignedContractorUploadsAndFileGoesToDiskWithGeneratedName() throws Exception {
        task.setAssignee(contractor);

        TaskFile file = service.upload(9L, contractor, multipart("C:\\fakepath\\heroina final.PSD", 10), false);

        assertEquals("heroina final.PSD", file.getOriginalName());
        assertEquals("application/x-photoshop", file.getContentType());
        assertEquals(1, file.getVersion());
        assertTrue(file.getStoredName().endsWith(".psd"));
        assertNotEquals(file.getOriginalName(), file.getStoredName());
        assertTrue(Files.exists(storage.resolve(file.getStoredName())));
    }

    @Test
    void versionsGrowAndOnlyOneFinalImage() {
        TaskFile first = service.upload(9L, owner, multipart("rascunho.png", 10), true);
        TaskFile second = service.upload(9L, owner, multipart("final.png", 10), true);

        assertEquals(2, second.getVersion());
        assertTrue(second.isFinalImage());
        assertFalse(first.isFinalImage());
    }

    @Test
    void rejectsDisallowedExtension() {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.upload(9L, owner, multipart("virus.exe", 10), false));

        assertEquals(415, exception.getStatusCode().value());
        verify(fileRepository, never()).save(any());
    }

    @Test
    void rejectsFileAboveLimit() {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.upload(9L, owner, multipart("enorme.zip", 2 * 1024 * 1024), false));

        assertEquals(413, exception.getStatusCode().value());
    }

    @Test
    void finalImageMustBePreviewable() {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.upload(9L, owner, multipart("cena.blend", 10), true));

        assertEquals(400, exception.getStatusCode().value());
    }

    @Test
    void contractorCannotSeeOrUploadToSomeoneElsesTask() {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.upload(9L, contractor, multipart("arte.png", 10), false));

        assertEquals(404, exception.getStatusCode().value());
    }

    @Test
    void contractorSeesButCannotUploadWhenOwnerSharesAllTasks() {
        project.setContractorsSeeAllTasks(true);

        assertTrue(service.list(9L, contractor).isEmpty());
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.upload(9L, contractor, multipart("arte.png", 10), false));
        assertEquals(403, exception.getStatusCode().value());
    }

    @Test
    void outsiderCannotDownload() {
        TaskFile file = service.upload(9L, owner, multipart("arte.png", 10), false);
        file.setId(30L);
        when(fileRepository.findById(30L)).thenReturn(Optional.of(file));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.load(30L, user(99L)));

        assertEquals(404, exception.getStatusCode().value());
        assertEquals(file, service.load(30L, owner).file());
    }

    @Test
    void deleteRemovesFromDisk() {
        TaskFile file = service.upload(9L, owner, multipart("arte.png", 10), false);
        file.setId(31L);
        when(fileRepository.findById(31L)).thenReturn(Optional.of(file));

        service.delete(31L, owner);

        assertFalse(Files.exists(storage.resolve(file.getStoredName())));
        verify(fileRepository).delete(file);
    }

    private static MockMultipartFile multipart(String name, int size) {
        return new MockMultipartFile("file", name, "application/octet-stream", new byte[size]);
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }
}
