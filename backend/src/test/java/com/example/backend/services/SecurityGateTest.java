package com.example.backend.services;

import com.example.backend.models.Post;
import com.example.backend.models.PostKind;
import com.example.backend.models.Role;
import com.example.backend.models.SecurityBan;
import com.example.backend.models.SecurityEvent;
import com.example.backend.models.User;
import com.example.backend.repositories.SecurityBanRepository;
import com.example.backend.repositories.SecurityEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SecurityGateTest {

    private final NetworkLists lists = new NetworkLists(List.of("10.8.0.0/16", "185.10.20.30/32"),
            List.of("tempmail.com", "mailinator.com"));
    private ClientContext client;
    private SecurityEventRepository events;
    private SecurityBanRepository bans;
    private SecurityGate gate;

    @BeforeEach
    void setUp() {
        client = mock(ClientContext.class);
        events = mock(SecurityEventRepository.class);
        bans = mock(SecurityBanRepository.class);
        when(bans.findByKindAndValue(any(), any())).thenReturn(List.of());
        gate = new SecurityGate(client, lists, events, bans, true, true, 2);
        from("200.150.1.2", "aparelho-123456");
    }

    @Test
    void listsMatchCidrsAndDisposableDomains() {
        assertTrue(lists.isVpn("10.8.255.1"));
        assertTrue(lists.isVpn("185.10.20.30"));
        assertFalse(lists.isVpn("185.10.20.31"));
        assertFalse(lists.isVpn("200.150.1.2"));
        assertFalse(lists.isVpn("::1"));
        assertTrue(lists.isDisposable("x@tempmail.com"));
        assertTrue(lists.isDisposable("x@sub.mailinator.com"));
        assertFalse(lists.isDisposable("x@gmail.com"));
    }

    @Test
    void vpnIsBlockedOnSignupLoginAndPostingWithTheWarning() {
        from("10.8.1.1", null);
        ResponseStatusException signup = assertThrows(ResponseStatusException.class, () -> gate.checkSignup("a@b.com"));
        assertEquals(403, signup.getStatusCode().value());
        assertEquals(SecurityGate.VPN_MESSAGE, signup.getReason());
        assertThrows(ResponseStatusException.class, () -> gate.checkLogin("a@b.com"));
        assertThrows(ResponseStatusException.class, () -> gate.checkPosting(user(), SecurityEvent.Type.POST));
        ArgumentCaptor<SecurityEvent> saved = ArgumentCaptor.forClass(SecurityEvent.class);
        verify(events, times(3)).save(saved.capture());
        assertTrue(saved.getAllValues().stream().allMatch(e -> e.getType() == SecurityEvent.Type.BLOCKED_VPN
                && "10.8.1.1".equals(e.getIp())));
    }

    @Test
    void disposableEmailAndTooManySignupsFromOneIpAreRefused() {
        assertEquals(400, status(() -> gate.checkSignup("alguem@tempmail.com")));
        when(events.countByTypeAndIpAndCreatedAtAfter(eq(SecurityEvent.Type.SIGNUP), eq("200.150.1.2"), any()))
                .thenReturn(2L);
        assertEquals(429, status(() -> gate.checkSignup("alguem@gmail.com")));
    }

    @Test
    void bannedDeviceIpOrEmailCannotSignUpOrLogIn() {
        SecurityBan device = new SecurityBan();
        device.setKind(SecurityBan.Kind.DEVICE);
        device.setValue("aparelho-123456");
        when(bans.findByKindAndValue(SecurityBan.Kind.DEVICE, "aparelho-123456")).thenReturn(List.of(device));
        assertEquals(403, status(() -> gate.checkSignup("novo@gmail.com")));
        assertEquals(403, status(() -> gate.checkLogin("novo@gmail.com")));
    }

    @Test
    void expiredIpBanNoLongerBlocks() {
        SecurityBan ip = new SecurityBan();
        ip.setKind(SecurityBan.Kind.IP);
        ip.setValue("200.150.1.2");
        ip.setExpiresAt(LocalDateTime.now().minusDays(1));
        when(bans.findByKindAndValue(SecurityBan.Kind.IP, "200.150.1.2")).thenReturn(List.of(ip));
        assertDoesNotThrow(() -> gate.checkLogin("ok@gmail.com"));
    }

    @Test
    void postingRecordsTheEventWithIpAndDevice() {
        gate.checkPosting(user(), SecurityEvent.Type.POST);
        ArgumentCaptor<SecurityEvent> saved = ArgumentCaptor.forClass(SecurityEvent.class);
        verify(events).save(saved.capture());
        assertEquals(SecurityEvent.Type.POST, saved.getValue().getType());
        assertEquals("200.150.1.2", saved.getValue().getIp());
        assertEquals("aparelho-123456", saved.getValue().getDeviceId());
        assertEquals(7L, saved.getValue().getUserId());
    }

    @Test
    void pendingPostsAndBlockedAuthorsAreNotPublic() {
        Post post = new Post();
        post.setKind(PostKind.STANDALONE);
        post.setAuthor(user());
        assertTrue(PostService.isPublic(post));
        post.setPendingReview(true);
        assertFalse(PostService.isPublic(post));
        assertTrue(PostService.isPublicContent(post));
        post.setPendingReview(false);
        post.getAuthor().setSuspended(true);
        assertFalse(PostService.isPublic(post));
        post.getAuthor().setSuspendedUntil(LocalDateTime.now().minusMinutes(1));
        assertTrue(PostService.isPublic(post));
    }

    private void from(String ip, String device) {
        when(client.current()).thenReturn(new ClientContext.Info(ip, "JUnit", device, ip));
    }

    private static User user() {
        User user = new User();
        user.setId(7L);
        user.setUsername("ana");
        user.setEmail("ana@test.test");
        user.setRole(Role.ARTIST);
        return user;
    }

    private static int status(Runnable action) {
        return assertThrows(ResponseStatusException.class, action::run).getStatusCode().value();
    }
}
