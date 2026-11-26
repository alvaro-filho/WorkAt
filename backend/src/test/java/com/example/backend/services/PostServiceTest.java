package com.example.backend.services;

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
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskFileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class PostServiceTest {

    @TempDir
    Path storageDir;

    private PostRepository postRepository;
    private PostImageRepository imageRepository;
    private TaskFileRepository fileRepository;
    private ProjectMemberRepository memberRepository;
    private PostService service;

    private User owner;
    private User stranger;
    private Project project;
    private Task task;

    @BeforeEach
    void setUp() {
        postRepository = mock(PostRepository.class);
        imageRepository = mock(PostImageRepository.class);
        fileRepository = mock(TaskFileRepository.class);
        memberRepository = mock(ProjectMemberRepository.class);
        when(postRepository.save(any(Post.class))).thenAnswer(invocation -> invocation.getArgument(0));
        service = new PostService(postRepository, imageRepository, fileRepository,
                new ProjectAccessService(mock(ProjectRepository.class), memberRepository),
                new FileStorage(storageDir.toString()));

        owner = user(1L);
        stranger = user(2L);
        project = new Project();
        project.setId(10L);
        project.setName("Exploração de designs");
        project.setType(ProjectType.PERSONAL);
        project.setCreatedByUser(owner);
        task = new Task();
        task.setId(20L);
        task.setTitle("Exploração de formas");
        task.setDescription("Silhuetas");
        task.setProject(project);
    }

    @Test
    void privateProjectHidesWipButNotStandalonePost() {
        Post wip = post(PostKind.WIP, project, task);
        Post standalone = post(PostKind.STANDALONE, project, task);
        Post loose = post(PostKind.STANDALONE, null, null);

        assertFalse(PostService.isPublic(wip));
        assertTrue(PostService.isPublic(standalone));
        assertTrue(PostService.isPublic(loose));

        project.setAutoWip(true);
        assertTrue(PostService.isPublic(wip));

        task.setHiddenFromPublic(true);
        assertFalse(PostService.isPublic(wip), "tarefa interna não aparece em público");
    }

    @Test
    void ndaHidesEverythingUntilReleaseDate() {
        project.setType(ProjectType.CORPORATE);
        project.setNdaEnabled(true);
        project.setAutoWip(true);
        Post wip = post(PostKind.WIP, project, task);
        Post standalone = post(PostKind.STANDALONE, project, task);

        assertFalse(PostService.isPublic(wip));
        assertFalse(PostService.isPublic(standalone));

        project.setNdaReleaseDate(LocalDate.now().plusDays(3));
        assertFalse(PostService.isPublic(wip));

        project.setNdaReleaseDate(LocalDate.now());
        assertTrue(PostService.isPublic(wip));
        assertTrue(PostService.isPublic(standalone));
    }

    @Test
    void ownerAndParticipantsSeePrivatePostsButStrangersDoNot() {
        Post wip = post(PostKind.WIP, project, task);
        wip.setAuthor(owner);

        assertTrue(service.canView(wip, owner));
        assertFalse(service.canView(wip, stranger));
        assertFalse(service.canView(wip, null));

        when(memberRepository.existsByProjectAndUser(project, stranger)).thenReturn(true);
        assertTrue(service.canView(wip, stranger));
    }

    @Test
    void imageUploadBecomesWipOnlyWithAutoWipOn() {
        TaskFile image = file(30L, "image/png");

        assertTrue(service.recordWip(image).isEmpty());

        project.setAutoWip(true);
        Optional<Post> created = service.recordWip(image);

        assertTrue(created.isPresent());
        assertEquals(PostKind.WIP, created.get().getKind());
        assertEquals(1, created.get().getImages().size());
        assertSame(owner, created.get().getAuthor());
    }

    @Test
    void nonImageFilesNeverBecomeWip() {
        project.setAutoWip(true);
        assertTrue(service.recordWip(file(31L, "application/x-photoshop")).isEmpty());
        verify(postRepository, never()).save(any());
    }

    @Test
    void uploadsWithinThirtyMinutesJoinTheSameWip() {
        project.setAutoWip(true);
        Post recent = post(PostKind.WIP, project, task);
        recent.getImages().add(PostImage.ofTaskFile(file(32L, "image/png")));
        when(postRepository.findFirstByAuthorAndTaskAndKindAndCreatedAtAfterOrderByIdDesc(
                eq(owner), eq(task), eq(PostKind.WIP), any(LocalDateTime.class))).thenReturn(Optional.of(recent));

        Post result = service.recordWip(file(33L, "image/jpeg")).orElseThrow();

        assertSame(recent, result);
        assertEquals(2, result.getImages().size());
    }

    @Test
    void wipLabelBecomesFinalWhenItHoldsTheFinalImage() {
        Post wip = post(PostKind.WIP, project, task);
        TaskFile image = file(34L, "image/png");
        wip.addImage(PostImage.ofTaskFile(image));
        assertEquals("WIP", PostService.labelOf(wip));

        image.setFinalImage(true);
        assertEquals("FINAL", PostService.labelOf(wip));
    }

    @Test
    void wipTakesTitleAndSubtitleFromTheTask() {
        Post wip = post(PostKind.WIP, project, task);
        wip.setAuthor(owner);

        var response = service.toResponse(wip);

        assertEquals("Exploração de formas", response.title());
        assertEquals("Silhuetas", response.subtitle());
        assertEquals("WIP", response.label());
    }

    @Test
    void publishAsPostIsBlockedUnderNda() {
        project.setType(ProjectType.CORPORATE);
        project.setNdaEnabled(true);
        TaskFile image = file(35L, "image/png");
        when(fileRepository.findById(35L)).thenReturn(Optional.of(image));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.publishTaskFile(35L, owner, null, null));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void publishAsPostWorksInPrivateProjectAndUsesTaskTitle() {
        TaskFile image = file(36L, "image/png");
        when(fileRepository.findById(36L)).thenReturn(Optional.of(image));

        Post post = service.publishTaskFile(36L, owner, "  ", "Primeira versão");

        assertEquals(PostKind.STANDALONE, post.getKind());
        assertEquals("Exploração de formas", post.getTitle());
        assertEquals("Primeira versão", post.getSubtitle());
        assertTrue(PostService.isPublic(post));
    }

    @Test
    void standalonePostRejectsNonImages() {
        MockMultipartFile pdf = new MockMultipartFile("file", "contrato.pdf", "application/pdf", new byte[]{1, 2});

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createStandalone(owner, pdf, "Título", null));
        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE, error.getStatusCode());
    }

    @Test
    void standalonePostStoresTheImage() {
        MockMultipartFile png = new MockMultipartFile("file", "lua.png", "image/png", new byte[]{1, 2, 3});

        Post post = service.createStandalone(owner, png, "Lua", "Estudo de luz");

        assertEquals(1, post.getImages().size());
        assertNotNull(post.getImages().get(0).getStoredName());
        assertTrue(storageDir.resolve(post.getImages().get(0).getStoredName()).toFile().exists());
    }

    @Test
    void onlyTheAuthorEditsAPost() {
        Post standalone = post(PostKind.STANDALONE, null, null);
        standalone.setId(40L);
        standalone.setAuthor(owner);
        when(postRepository.findById(40L)).thenReturn(Optional.of(standalone));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.update(40L, stranger, null, null, true));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());

        service.update(40L, owner, null, null, true);
        assertTrue(standalone.isHiddenFromPortfolio());
    }

    @Test
    void deletingTheLastImageRemovesTheWip() {
        TaskFile image = file(37L, "image/png");
        Post wip = post(PostKind.WIP, project, task);
        wip.addImage(PostImage.ofTaskFile(image));
        when(imageRepository.findByTaskFileIn(List.of(image))).thenReturn(List.copyOf(wip.getImages()));

        service.detachTaskFiles(List.of(image));

        verify(postRepository).delete(wip);
    }

    private Post post(PostKind kind, Project postProject, Task postTask) {
        Post post = new Post();
        post.setKind(kind);
        post.setAuthor(owner);
        post.setProject(postProject);
        post.setTask(postTask);
        return post;
    }

    private TaskFile file(Long id, String contentType) {
        TaskFile file = new TaskFile();
        file.setId(id);
        file.setTask(task);
        file.setUploadedBy(owner);
        file.setContentType(contentType);
        file.setStoredName("f" + id + ".bin");
        return file;
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setUsername("u" + id);
        user.setFullName("Usuário " + id);
        user.setEmail("u" + id + "@teste.local");
        return user;
    }

    @Test
    void standalonePostAcceptsUpToSixImages() {
        List<org.springframework.web.multipart.MultipartFile> six = new java.util.ArrayList<>();
        for (int i = 0; i < 6; i++) {
            six.add(new MockMultipartFile("file", "etapa" + i + ".png", "image/png", new byte[]{1, 2, (byte) i}));
        }

        Post post = service.createStandalone(owner, six, "Estudos", null);

        assertEquals(6, post.getImages().size());
    }

    @Test
    void standalonePostRejectsTheSeventhImage() {
        List<org.springframework.web.multipart.MultipartFile> seven = new java.util.ArrayList<>();
        for (int i = 0; i < 7; i++) {
            seven.add(new MockMultipartFile("file", "etapa" + i + ".png", "image/png", new byte[]{1, 2, (byte) i}));
        }

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createStandalone(owner, seven, "Estudos", null));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(postRepository, never()).save(any(Post.class));
    }

    @Test
    void likeIsSavedOnceAndCanBeUndone() {
        com.example.backend.repositories.PostReactionRepository reactions =
                mock(com.example.backend.repositories.PostReactionRepository.class);
        service.setReactionRepository(reactions);
        Post standalone = post(PostKind.STANDALONE, null, null);
        standalone.setId(41L);
        standalone.setAuthor(owner);
        when(postRepository.findById(41L)).thenReturn(Optional.of(standalone));
        com.example.backend.models.PostReaction existing = com.example.backend.models.PostReaction.of(
                standalone, stranger, com.example.backend.models.PostReaction.Type.LIKE);

        when(reactions.findByPostAndUserAndType(standalone, stranger, com.example.backend.models.PostReaction.Type.LIKE))
                .thenReturn(Optional.empty());
        service.react(41L, stranger, com.example.backend.models.PostReaction.Type.LIKE, true);
        verify(reactions).save(any(com.example.backend.models.PostReaction.class));

        when(reactions.findByPostAndUserAndType(standalone, stranger, com.example.backend.models.PostReaction.Type.LIKE))
                .thenReturn(Optional.of(existing));
        service.react(41L, stranger, com.example.backend.models.PostReaction.Type.LIKE, true);
        verify(reactions, times(1)).save(any(com.example.backend.models.PostReaction.class));

        service.react(41L, stranger, com.example.backend.models.PostReaction.Type.LIKE, false);
        verify(reactions).delete(existing);
    }

    @Test
    void cannotReactToAPostYouCannotSee() {
        service.setReactionRepository(mock(com.example.backend.repositories.PostReactionRepository.class));
        project.setNdaEnabled(true);
        project.setType(ProjectType.CORPORATE);
        Post wip = post(PostKind.WIP, project, task);
        wip.setId(42L);
        wip.setAuthor(owner);
        when(postRepository.findById(42L)).thenReturn(Optional.of(wip));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.react(42L, stranger, com.example.backend.models.PostReaction.Type.SAVE, true));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }
}
