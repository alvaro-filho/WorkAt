package com.example.backend.services;

import com.example.backend.models.Notification;
import com.example.backend.models.Post;
import com.example.backend.models.PostComment;
import com.example.backend.models.PostKind;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectType;
import com.example.backend.models.User;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.PostCommentRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PostCommentServiceTest {

    private PostCommentRepository commentRepository;
    private PostRepository postRepository;
    private PostService postService;
    private NotificationRepository notificationRepository;
    private PostCommentService service;
    private User author;
    private User visitor;
    private Post post;

    @BeforeEach
    void setUp() {
        commentRepository = mock(PostCommentRepository.class);
        postRepository = mock(PostRepository.class);
        ProjectRepository projectRepository = mock(ProjectRepository.class);
        postService = mock(PostService.class);
        notificationRepository = mock(NotificationRepository.class);
        service = new PostCommentService(commentRepository, postRepository, projectRepository, postService,
                new ProjectAccessService(projectRepository, mock(ProjectMemberRepository.class)), notificationRepository);

        author = user(1L, "Ana");
        visitor = user(2L, "Beto");
        post = new Post();
        post.setId(10L);
        post.setAuthor(author);
        post.setKind(PostKind.STANDALONE);
        post.setTitle("Criatura");
        when(postRepository.findById(10L)).thenReturn(Optional.of(post));
        when(postService.canView(eq(post), any())).thenReturn(true);
        when(commentRepository.save(any(PostComment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(commentRepository.findByPostOrderByIdAsc(post)).thenReturn(List.of());
    }

    @Test
    void corporateProjectsStartWithCommentsOffAndPostsFollowTheProject() {
        Project corporate = project(ProjectType.CORPORATE);
        Project coop = project(ProjectType.COOPERATIVE);
        assertFalse(PostCommentService.projectCommentsOn(corporate));
        assertTrue(PostCommentService.projectCommentsOn(coop));

        post.setProject(corporate);
        assertFalse(PostCommentService.postCommentsOn(post), "publicação do corporativo segue o projeto");
        corporate.setCommentsEnabled(true);
        assertTrue(PostCommentService.postCommentsOn(post), "o diretor ligou");
        post.setCommentsEnabled(false);
        assertFalse(PostCommentService.postCommentsOn(post), "o autor desligou só esta publicação");
    }

    @Test
    void visitorCommentsAndTheAuthorIsNotified() {
        service.addToPost(10L, visitor, "  Que silhueta boa!  ", null);

        ArgumentCaptor<PostComment> saved = ArgumentCaptor.forClass(PostComment.class);
        verify(commentRepository).save(saved.capture());
        assertEquals("Que silhueta boa!", saved.getValue().getBody());
        ArgumentCaptor<Notification> notice = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(notice.capture());
        assertSame(author, notice.getValue().getUser());
        assertEquals("POST_COMMENT", notice.getValue().getType());
    }

    @Test
    void authorCommentingOnOwnPostDoesNotNotifyHimself() {
        service.addToPost(10L, author, "Obrigada!", null);
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void cannotCommentOnAPostYouCannotSee() {
        when(postService.canView(post, visitor)).thenReturn(false);
        assertEquals(404, status(() -> service.addToPost(10L, visitor, "oi", null)));
        verify(commentRepository, never()).save(any());
    }

    @Test
    void disabledCommentsRefuseNewOnes() {
        post.setCommentsEnabled(false);
        assertEquals(409, status(() -> service.addToPost(10L, visitor, "oi", null)));
    }

    @Test
    void emptyOrTooLongIsRefusedAndRepliesAreOneLevel() {
        assertEquals(400, status(() -> service.addToPost(10L, visitor, "   ", null)));
        assertEquals(400, status(() -> service.addToPost(10L, visitor, "a".repeat(1001), null)));

        PostComment top = comment(50L, author, null);
        PostComment reply = comment(51L, visitor, top);
        when(commentRepository.findById(51L)).thenReturn(Optional.of(reply));
        assertEquals(400, status(() -> service.addToPost(10L, visitor, "resposta da resposta", 51L)));
    }

    @Test
    void spamLimitPerHour() {
        when(commentRepository.countByAuthorAndCreatedAtAfter(eq(visitor), any())).thenReturn(30L);
        assertEquals(429, status(() -> service.addToPost(10L, visitor, "mais um", null)));
    }

    @Test
    void deletingACommentWithRepliesKeepsItAsRemoved() {
        PostComment top = comment(60L, visitor, null);
        when(commentRepository.findById(60L)).thenReturn(Optional.of(top));
        when(commentRepository.existsByParent(top)).thenReturn(true);

        service.delete(60L, author); // o autor da publicação modera

        assertTrue(top.isRemoved());
        assertEquals("", top.getBody());
        verify(commentRepository, never()).delete(any(PostComment.class));
    }

    @Test
    void strangerCannotDeleteSomeoneElsesComment() {
        User stranger = user(3L, "Caio");
        PostComment top = comment(61L, visitor, null);
        when(commentRepository.findById(61L)).thenReturn(Optional.of(top));
        assertEquals(403, status(() -> service.delete(61L, stranger)));
    }

    // ---- ajudantes ----

    private PostComment comment(Long id, User who, PostComment parent) {
        PostComment comment = new PostComment();
        comment.setId(id);
        comment.setPost(post);
        comment.setAuthor(who);
        comment.setParent(parent);
        comment.setBody("texto");
        return comment;
    }

    private static Project project(ProjectType type) {
        Project project = new Project();
        project.setId(70L);
        project.setType(type);
        return project;
    }

    private static User user(Long id, String name) {
        User user = new User();
        user.setId(id);
        user.setFullName(name);
        return user;
    }

    private static int status(Runnable action) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, action::run);
        return error.getStatusCode().value();
    }
}
