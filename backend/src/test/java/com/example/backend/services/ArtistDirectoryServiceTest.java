package com.example.backend.services;

import com.example.backend.config.BusinessTime;
import com.example.backend.dto.ArtistDtos.ArtistCard;
import com.example.backend.models.JobCall;
import com.example.backend.models.JobInterest;
import com.example.backend.models.Notification;
import com.example.backend.models.Post;
import com.example.backend.models.PostImage;
import com.example.backend.models.PostKind;
import com.example.backend.models.Role;
import com.example.backend.models.User;
import com.example.backend.repositories.JobCallRepository;
import com.example.backend.repositories.JobInterestRepository;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ArtistDirectoryServiceTest {

    private UserRepository userRepository;
    private PostRepository postRepository;
    private JobInterestRepository interestRepository;
    private NotificationRepository notificationRepository;
    private ArtistDirectoryService service;
    private User studio;
    private User ana;
    private User bruno;
    private User semArte;
    private JobCall call;
    private long nextPostId = 1;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        postRepository = mock(PostRepository.class);
        PostService postService = mock(PostService.class);
        JobCallRepository callRepository = mock(JobCallRepository.class);
        interestRepository = mock(JobInterestRepository.class);
        notificationRepository = mock(NotificationRepository.class);
        service = new ArtistDirectoryService(userRepository, postRepository, postService, callRepository,
                interestRepository, notificationRepository);

        studio = user(1L, "estudio", Role.COMPANY, null);
        ana = user(2L, "ana", Role.ARTIST, "Concept art, Ilustração");
        bruno = user(3L, "bruno", Role.ARTIST, "Modelagem 3D, Blender");
        semArte = user(4L, "sem", Role.ARTIST, "Concept art");
        available(ana, LocalDateTime.now().minusDays(2));
        available(semArte, LocalDateTime.now());
        when(userRepository.findByRoleAndDeletedFalse(Role.ARTIST)).thenReturn(List.of(ana, bruno, semArte));
        when(userRepository.findByUsername("ana")).thenReturn(Optional.of(ana));
        when(userRepository.findByUsername("bruno")).thenReturn(Optional.of(bruno));
        when(postRepository.findByAuthorOrderByIdDesc(ana)).thenReturn(List.of(post(ana), post(ana), post(ana), post(ana)));
        when(postRepository.findByAuthorOrderByIdDesc(bruno)).thenReturn(List.of(post(bruno)));
        when(postRepository.findByAuthorOrderByIdDesc(semArte)).thenReturn(List.of());
        when(postService.toResponses(any(), any())).thenReturn(List.of());

        call = new JobCall();
        call.setId(10L);
        call.setAuthor(studio);
        call.setTitle("Concept de criaturas");
        call.setRole(JobCall.Role.CONCEPT);
        call.setClosesOn(BusinessTime.today().plusDays(5));
        when(callRepository.findById(10L)).thenReturn(Optional.of(call));
        when(interestRepository.findByCallOrderByIdAsc(call)).thenReturn(List.of());
        when(interestRepository.findByCallAndArtist(any(), any())).thenReturn(Optional.empty());
    }

    @Test
    void specialtiesMatchTheRoleByWord() {
        assertTrue(ArtistDirectoryService.matchesRole("Concept art, Ilustração", JobCall.Role.ILUSTRACAO));
        assertTrue(ArtistDirectoryService.matchesRole("Modelagem 3D", JobCall.Role.MODELAGEM_3D));
        assertTrue(ArtistDirectoryService.matchesRole("Design de UI", JobCall.Role.UI));
        assertTrue(ArtistDirectoryService.matchesRole("Quadrinhos", JobCall.Role.HQ));
        assertFalse(ArtistDirectoryService.matchesRole("Guia de estilo", JobCall.Role.UI));
        assertFalse(ArtistDirectoryService.matchesRole(null, JobCall.Role.CONCEPT));
        assertTrue(ArtistDirectoryService.matchesRole(null, null));
        assertTrue(ArtistDirectoryService.matchesRole("Qualquer coisa", JobCall.Role.OUTRO));
    }

    @Test
    void exploreShowsOnlyArtistsWithWorkAndPutsAvailableFirst() {
        List<ArtistCard> all = service.explore(null, false, null);
        assertEquals(List.of("ana", "bruno"), all.stream().map(card -> card.user().username()).toList());
        assertNotNull(all.get(0).availability());
        assertNull(all.get(1).availability());
        verify(postServiceOf(), atLeastOnce()).toResponses(argThatSize(3), any());
    }

    @Test
    void exploreFiltersByRoleAndAvailability() {
        assertEquals(List.of("bruno"), names(service.explore(JobCall.Role.MODELAGEM_3D, false, null)));
        assertEquals(List.of("ana"), names(service.explore(null, true, null)));
        assertEquals(List.of(), names(service.explore(JobCall.Role.MODELAGEM_3D, true, null)));
    }

    @Test
    void suggestionsAreOnlyForTheAuthorAndSkipWhoAlreadyApplied() {
        assertEquals(403, status(() -> service.suggestions(10L, ana)));
        assertEquals(List.of("ana"), names(service.suggestions(10L, studio)));
        JobInterest interest = new JobInterest();
        interest.setArtist(ana);
        when(interestRepository.findByCallOrderByIdAsc(call)).thenReturn(List.of(interest));
        assertEquals(List.of(), names(service.suggestions(10L, studio)));
    }

    @Test
    void nudgeNotifiesOnceAndOnlyAvailableArtists() {
        assertEquals(400, status(() -> service.nudge(10L, "bruno", studio)));
        service.nudge(10L, "ana", studio);
        ArgumentCaptor<Notification> sent = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(sent.capture());
        assertEquals(ana, sent.getValue().getUser());
        assertEquals("CALL_NUDGE", sent.getValue().getType());
        assertEquals("/chamadas/10", sent.getValue().getLink());

        when(notificationRepository.existsByUserAndRefKey(eq(ana), anyString())).thenReturn(true);
        assertEquals(409, status(() -> service.nudge(10L, "ana", studio)));
    }

    @Test
    void nudgeNeedsAnOpenCallAndHasALimit() {
        when(notificationRepository.countByRefKey(anyString())).thenReturn(20L);
        assertEquals(409, status(() -> service.nudge(10L, "ana", studio)));
        when(notificationRepository.countByRefKey(anyString())).thenReturn(0L);
        call.setStatus(JobCall.Status.FILLED);
        assertEquals(409, status(() -> service.nudge(10L, "ana", studio)));
    }

    // ---- ajudantes ----

    private PostService postServiceOf() {
        try {
            var field = ArtistDirectoryService.class.getDeclaredField("postService");
            field.setAccessible(true);
            return (PostService) field.get(service);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static List<Post> argThatSize(int size) {
        return org.mockito.ArgumentMatchers.argThat(list -> list != null && list.size() == size);
    }

    private static List<String> names(List<ArtistCard> cards) {
        return cards.stream().map(card -> card.user().username()).toList();
    }

    private Post post(User author) {
        Post post = new Post();
        post.setId(nextPostId++);
        post.setAuthor(author);
        post.setKind(PostKind.STANDALONE);
        post.addImage(new PostImage());
        return post;
    }

    private static void available(User user, LocalDateTime since) {
        user.setAvailableForWork(true);
        user.setAvailableFormats("FREELA");
        user.setAvailableLocation("REMOTO");
        user.setAvailableUpdatedAt(since);
    }

    private static int status(Runnable action) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, action::run);
        return error.getStatusCode().value();
    }

    private static User user(Long id, String username, Role role, String specialties) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setFullName(username);
        user.setEmail(username + "@test.test");
        user.setRole(role);
        user.setSpecialties(specialties);
        return user;
    }
}
