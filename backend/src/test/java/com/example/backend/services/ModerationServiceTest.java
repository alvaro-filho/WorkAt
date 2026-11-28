package com.example.backend.services;

import com.example.backend.models.Notification;
import com.example.backend.models.Post;
import com.example.backend.models.PostKind;
import com.example.backend.models.Role;
import com.example.backend.models.SecurityBan;
import com.example.backend.models.User;
import com.example.backend.repositories.AdminActionRepository;
import com.example.backend.repositories.JobCallRepository;
import com.example.backend.repositories.JobInterestRepository;
import com.example.backend.repositories.ModerationEvidenceRepository;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.PostCommentRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.SecurityBanRepository;
import com.example.backend.repositories.SecurityEventRepository;
import com.example.backend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ModerationServiceTest {

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private AdminService admin;
    private EvidenceService evidence;
    private UserRepository userRepository;
    private PostRepository postRepository;
    private SecurityEventRepository eventRepository;
    private SecurityBanRepository banRepository;
    private NotificationRepository notificationRepository;
    private PostService postService;
    private ModerationService service;
    private User boss;
    private User troll;

    @BeforeEach
    void setUp() {
        admin = mock(AdminService.class);
        evidence = mock(EvidenceService.class);
        userRepository = mock(UserRepository.class);
        postRepository = mock(PostRepository.class);
        eventRepository = mock(SecurityEventRepository.class);
        banRepository = mock(SecurityBanRepository.class);
        notificationRepository = mock(NotificationRepository.class);
        postService = mock(PostService.class);
        AdminAccess access = new AdminAccess("boss@workat.test");
        service = new ModerationService(admin, evidence, userRepository, postRepository,
                mock(PostCommentRepository.class), mock(JobCallRepository.class), mock(JobInterestRepository.class),
                eventRepository, banRepository, mock(ModerationEvidenceRepository.class), notificationRepository,
                mock(AdminActionRepository.class), postService, mock(PostCommentService.class),
                mock(FileStorage.class), access, encoder);

        boss = user(1L, "boss", "boss@workat.test");
        boss.setPasswordHash(encoder.encode("Senha123"));
        troll = user(2L, "troll", "Troll@Mail.com");
        when(userRepository.findById(2L)).thenReturn(Optional.of(troll));
        when(userRepository.findById(1L)).thenReturn(Optional.of(boss));
        when(eventRepository.devicesOf(2L)).thenReturn(List.of("aparelho-abc12345"));
        when(eventRepository.ipsOf(eq(2L), any())).thenReturn(List.of("200.1.2.3", "189.4.5.6"));
    }

    @Test
    void banHidesWithoutDeletingAndBlocksEmailDevicesAndIps() {
        service.ban(boss, 2L, "Postou nudez", "Senha123");

        assertTrue(troll.isBanned());
        assertTrue(troll.isBlocked());
        verify(evidence).freeze(eq(troll), eq("BAN"), eq("Postou nudez"), eq("boss@workat.test"), isNull());
        verify(postService, never()).delete(any(), any());
        ArgumentCaptor<SecurityBan> bans = ArgumentCaptor.forClass(SecurityBan.class);
        verify(banRepository, times(4)).save(bans.capture());
        assertEquals(List.of(SecurityBan.Kind.EMAIL, SecurityBan.Kind.DEVICE, SecurityBan.Kind.IP, SecurityBan.Kind.IP),
                bans.getAllValues().stream().map(SecurityBan::getKind).toList());
        assertEquals("troll@mail.com", bans.getAllValues().get(0).getValue());
        assertNull(bans.getAllValues().get(1).getExpiresAt(), "aparelho fica banido para sempre");
        assertNotNull(bans.getAllValues().get(2).getExpiresAt(), "IP vale 90 dias");
    }

    @Test
    void banNeedsThePasswordAndNeverHitsTheAdminItself() {
        assertEquals(400, status(() -> service.ban(boss, 2L, "motivo", "errada")));
        assertEquals(400, status(() -> service.ban(boss, 1L, "motivo", "Senha123")));
        assertFalse(troll.isBanned());
    }

    @Test
    void removePostFreezesEvidenceDeletesAndTellsTheAuthorAboutTheGuidelines() {
        Post post = new Post();
        post.setId(50L);
        post.setKind(PostKind.STANDALONE);
        post.setAuthor(troll);
        post.setTitle("Foto");
        when(postRepository.findById(50L)).thenReturn(Optional.of(post));

        service.removePost(boss, 50L, "Conteúdo adulto");

        verify(evidence).freeze(troll, "REMOVE_POST", "Conteúdo adulto", "boss@workat.test", post);
        verify(postService).delete(50L, troll);
        ArgumentCaptor<Notification> sent = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(sent.capture());
        assertEquals(troll, sent.getValue().getUser());
        assertTrue(sent.getValue().getMessage().contains("violar as diretrizes da moderação"));
        assertTrue(sent.getValue().getMessage().contains("Conteúdo adulto"));
    }

    @Test
    void approvingThreePostsMakesTheAccountTrusted() {
        troll.setTrusted(false);
        Post post = new Post();
        post.setId(60L);
        post.setAuthor(troll);
        post.setPendingReview(true);
        when(postRepository.findById(60L)).thenReturn(Optional.of(post));
        when(postRepository.countByAuthorAndPendingReviewFalse(troll)).thenReturn(3L);

        service.approvePost(boss, 60L);

        assertFalse(post.isPendingReview());
        assertTrue(troll.isTrusted());
    }

    private static User user(Long id, String username, String email) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setFullName(username);
        user.setEmail(email);
        user.setRole(Role.ARTIST);
        return user;
    }

    private static int status(Runnable action) {
        return assertThrows(ResponseStatusException.class, action::run).getStatusCode().value();
    }
}
