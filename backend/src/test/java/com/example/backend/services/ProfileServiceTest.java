package com.example.backend.services;

import com.example.backend.dto.ProfileResponse;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectType;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ProfileServiceTest {
    private ProjectService projectService;
    private ProjectMemberRepository memberRepository;
    private ProfileService service;

    private User artist;
    private User studio;
    private User visitor;
    private Project personal;
    private Project cooperative;
    private Project corporateNda;

    @BeforeEach
    void setUp() {
        UserRepository userRepository = mock(UserRepository.class);
        projectService = mock(ProjectService.class);
        memberRepository = mock(ProjectMemberRepository.class);
        PostService postService = mock(PostService.class);
        ActivityEventService activityEventService = mock(ActivityEventService.class);
        service = new ProfileService(userRepository, projectService,
                new ProjectAccessService(mock(ProjectRepository.class), memberRepository),
                postService, activityEventService);

        artist = user(1L, "artista", "Ana Artista");
        studio = user(2L, "estudio", "Estúdio Lua");
        visitor = user(3L, "visita", "Visitante");
        personal = project(10L, "Estudos de anatomia", ProjectType.PERSONAL, artist);
        cooperative = project(11L, "HQ com amigos", ProjectType.COOPERATIVE, artist);
        corporateNda = project(12L, "Jogo secreto", ProjectType.CORPORATE, studio);
        corporateNda.setNdaEnabled(true);

        when(userRepository.findByUsername("artista")).thenReturn(Optional.of(artist));
        when(projectService.findProjectsForUser(artist)).thenReturn(List.of(personal, cooperative, corporateNda));
        when(memberRepository.existsByProjectAndUser(corporateNda, artist)).thenReturn(true);
        when(postService.visibleByAuthor(any(), any())).thenReturn(List.of());
        when(activityEventService.getHeatmap(1L)).thenReturn(List.of());
    }

    @Test
    void visitorSeesNdaProjectMaskedWithTheContractingParty() {
        ProfileResponse profile = service.profile("artista", visitor);

        assertFalse(profile.me());
        assertEquals(1, profile.hiddenPersonalProjects());
        assertEquals(2, profile.projects().size());
        ProfileResponse.ProfileProject masked = profile.projects().get(1);
        assertTrue(masked.masked());
        assertNull(masked.name());
        assertNull(masked.id());
        assertEquals("Estúdio Lua", masked.ownerName());
        assertEquals("HQ com amigos", profile.projects().get(0).name());
    }

    @Test
    void ownerOfTheProfileSeesEverything() {
        ProfileResponse profile = service.profile("artista", artist);

        assertTrue(profile.me());
        assertEquals(0, profile.hiddenPersonalProjects());
        assertEquals(3, profile.projects().size());
        assertTrue(profile.projects().stream().noneMatch(ProfileResponse.ProfileProject::masked));
        assertTrue(profile.projects().get(2).nda());
    }

    @Test
    void participantOfTheNdaProjectSeesItUnmasked() {
        ProfileResponse profile = service.profile("artista", studio);

        assertEquals("Jogo secreto", profile.projects().get(1).name());
    }

    @Test
    void unknownUsernameIs404() {
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.profile("ninguem", visitor))
                .getStatusCode().value());
    }

    private static Project project(Long id, String name, ProjectType type, User owner) {
        Project project = new Project();
        project.setId(id);
        project.setName(name);
        project.setType(type);
        project.setCreatedByUser(owner);
        return project;
    }

    private static User user(Long id, String username, String name) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setFullName(name);
        return user;
    }
}
