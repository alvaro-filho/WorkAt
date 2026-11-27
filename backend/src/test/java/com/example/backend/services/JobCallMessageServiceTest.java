package com.example.backend.services;

import com.example.backend.config.BusinessTime;
import com.example.backend.dto.JobCallDtos.Conversation;
import com.example.backend.models.JobCall;
import com.example.backend.models.JobInterest;
import com.example.backend.models.JobInterestMessage;
import com.example.backend.models.Notification;
import com.example.backend.models.Role;
import com.example.backend.models.User;
import com.example.backend.repositories.JobCallRepository;
import com.example.backend.repositories.JobInterestMessageRepository;
import com.example.backend.repositories.JobInterestRepository;
import com.example.backend.repositories.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class JobCallMessageServiceTest {

    private JobInterestMessageRepository messageRepository;
    private NotificationRepository notificationRepository;
    private JobCallMessageService service;
    private User studio;
    private User artist;
    private User stranger;
    private JobInterest interest;
    private final List<JobInterestMessage> stored = new ArrayList<>();

    @BeforeEach
    void setUp() {
        JobCallRepository callRepository = mock(JobCallRepository.class);
        JobInterestRepository interestRepository = mock(JobInterestRepository.class);
        messageRepository = mock(JobInterestMessageRepository.class);
        notificationRepository = mock(NotificationRepository.class);
        service = new JobCallMessageService(callRepository, interestRepository, messageRepository, notificationRepository);

        studio = user(1L, "Estúdio", Role.COMPANY);
        artist = user(2L, "Ana", Role.ARTIST);
        stranger = user(3L, "Outro", Role.ARTIST);
        JobCall call = new JobCall();
        call.setId(10L);
        call.setAuthor(studio);
        call.setTitle("Concept de criaturas");
        call.setClosesOn(BusinessTime.today().plusDays(5));
        interest = new JobInterest();
        interest.setId(20L);
        interest.setCall(call);
        interest.setArtist(artist);
        interest.setMessage("Quero!");
        interest.setStatus(JobInterest.Status.SEEN);

        when(callRepository.findById(10L)).thenReturn(Optional.of(call));
        when(interestRepository.findById(20L)).thenReturn(Optional.of(interest));
        when(messageRepository.findByInterestOrderByIdAsc(interest)).thenAnswer(invocation -> List.copyOf(stored));
        when(messageRepository.countByInterest(interest)).thenAnswer(invocation -> (long) stored.size());
        when(messageRepository.save(any(JobInterestMessage.class))).thenAnswer(invocation -> {
            JobInterestMessage message = invocation.getArgument(0);
            message.setId((long) stored.size() + 1);
            stored.add(message);
            return message;
        });
    }

    @Test
    void onlyTheStudioAndTheCandidateSeeTheConversation() {
        assertEquals(403, status(() -> service.conversation(10L, 20L, stranger)));
        assertNotNull(service.conversation(10L, 20L, studio));
        assertNotNull(service.conversation(10L, 20L, artist));
    }

    @Test
    void theStudioStartsAndThenBothWrite() {
        Conversation before = service.conversation(10L, 20L, artist);
        assertFalse(before.canSend());
        assertEquals(409, status(() -> service.send(10L, 20L, artist, "Oi!")));

        Conversation afterStudio = service.send(10L, 20L, studio, "  Você tem agenda em janeiro?  ");
        assertEquals("Você tem agenda em janeiro?", afterStudio.messages().get(0).body());
        assertTrue(afterStudio.messages().get(0).mine());

        Conversation afterArtist = service.send(10L, 20L, artist, "Tenho sim.");
        assertEquals(2, afterArtist.messages().size());
        assertFalse(afterArtist.messages().get(0).mine());
        assertTrue(afterArtist.canSend());
    }

    @Test
    void eachMessageNotifiesTheOtherSide() {
        service.send(10L, 20L, studio, "Oi, Ana");
        service.send(10L, 20L, artist, "Oi!");
        ArgumentCaptor<Notification> sent = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(2)).save(sent.capture());
        assertEquals(artist, sent.getAllValues().get(0).getUser());
        assertEquals(studio, sent.getAllValues().get(1).getUser());
        assertEquals("CALL_MESSAGE", sent.getAllValues().get(0).getType());
        assertEquals("/chamadas/10", sent.getAllValues().get(0).getLink());
    }

    @Test
    void textOnlyUpToTheLimit() {
        assertEquals(400, status(() -> service.send(10L, 20L, studio, "   ")));
        assertEquals(400, status(() -> service.send(10L, 20L, studio, "x".repeat(1001))));
        assertNotNull(service.send(10L, 20L, studio, "x".repeat(1000)));
    }

    @Test
    void notSelectedLeavesTheConversationReadOnly() {
        service.send(10L, 20L, studio, "Oi");
        interest.setStatus(JobInterest.Status.NOT_SELECTED);
        assertEquals(409, status(() -> service.send(10L, 20L, studio, "mais uma")));
        assertEquals(409, status(() -> service.send(10L, 20L, artist, "e eu?")));
        Conversation readOnly = service.conversation(10L, 20L, artist);
        assertFalse(readOnly.canSend());
        assertEquals(1, readOnly.messages().size());
    }

    @Test
    void invitedCandidatesKeepTalking() {
        service.send(10L, 20L, studio, "Te mandei o convite");
        interest.setStatus(JobInterest.Status.INVITED);
        assertTrue(service.send(10L, 20L, artist, "Aceitei!").canSend());
    }

    private static int status(Runnable action) {
        try {
            action.run();
            return 200;
        } catch (ResponseStatusException e) {
            return e.getStatusCode().value();
        }
    }

    private static User user(Long id, String name, Role role) {
        User user = new User();
        user.setId(id);
        user.setFullName(name);
        user.setUsername(name.toLowerCase());
        user.setEmail(name.toLowerCase() + "@test.dev");
        user.setRole(role);
        return user;
    }
}
