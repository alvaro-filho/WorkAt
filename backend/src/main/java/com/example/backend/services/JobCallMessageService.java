package com.example.backend.services;

import com.example.backend.dto.JobCallDtos.CallMessage;
import com.example.backend.dto.JobCallDtos.Conversation;
import com.example.backend.dto.UserSummary;
import com.example.backend.models.JobCall;
import com.example.backend.models.JobInterest;
import com.example.backend.models.JobInterestMessage;
import com.example.backend.models.Notification;
import com.example.backend.models.User;
import com.example.backend.repositories.JobCallRepository;
import com.example.backend.repositories.JobInterestMessageRepository;
import com.example.backend.repositories.JobInterestRepository;
import com.example.backend.repositories.NotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Conversa da Chamada: estúdio e candidato trocam mensagens presas à candidatura.
 * - Só os dois leem e escrevem; quem começa é o estúdio (ninguém recebe mensagem do nada).
 * - Só texto, até 1000 caracteres. Candidatura "não selecionada" deixa a conversa só para leitura;
 *   retirada, a candidatura some e a conversa vai junto.
 * - Sem tempo real: cada mensagem vira notificação para o outro lado.
 */
@Service
public class JobCallMessageService {

    static final int MAX_BODY = 1000;

    private final JobCallRepository callRepository;
    private final JobInterestRepository interestRepository;
    private final JobInterestMessageRepository messageRepository;
    private final NotificationRepository notificationRepository;

    public JobCallMessageService(JobCallRepository callRepository, JobInterestRepository interestRepository,
                                 JobInterestMessageRepository messageRepository,
                                 NotificationRepository notificationRepository) {
        this.callRepository = callRepository;
        this.interestRepository = interestRepository;
        this.messageRepository = messageRepository;
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public Conversation conversation(Long callId, Long interestId, User user) {
        JobInterest interest = participantInterest(callId, interestId, user);
        return toConversation(interest, user);
    }

    @Transactional
    public Conversation send(Long callId, Long interestId, User user, String body) {
        JobInterest interest = participantInterest(callId, interestId, user);
        String text = body == null ? "" : body.trim();
        if (text.isEmpty() || text.length() > MAX_BODY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Escreva uma mensagem de até " + MAX_BODY + " caracteres.");
        }
        String blocked = blockedReason(interest, user, messageRepository.countByInterest(interest));
        if (blocked != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, blocked);
        }
        JobInterestMessage message = new JobInterestMessage();
        message.setInterest(interest);
        message.setAuthor(user);
        message.setBody(text);
        messageRepository.save(message);

        JobCall call = interest.getCall();
        boolean fromStudio = isStudio(interest, user);
        User to = fromStudio ? interest.getArtist() : call.getAuthor();
        notify(to, user.getFullName() + " te mandou uma mensagem sobre \"" + call.getTitle() + "\".",
                "/chamadas/" + call.getId());
        return toConversation(interest, user);
    }

    // ---- Regras internas ----

    /** A candidatura, se ela é desta Chamada e quem pede é o estúdio que publicou ou o artista que se candidatou. */
    private JobInterest participantInterest(Long callId, Long interestId, User user) {
        JobCall call = callRepository.findById(callId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chamada não encontrada."));
        JobInterest interest = interestRepository.findById(interestId)
                .filter(found -> found.getCall().getId().equals(call.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidatura não encontrada."));
        if (!isStudio(interest, user) && !ProjectAccessService.sameUser(interest.getArtist(), user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Só o estúdio e quem se candidatou veem essa conversa.");
        }
        return interest;
    }

    private static boolean isStudio(JobInterest interest, User user) {
        return ProjectAccessService.sameUser(interest.getCall().getAuthor(), user);
    }

    /** Por que essa pessoa não pode escrever agora (null = pode). */
    static String blockedReason(JobInterest interest, User user, long messageCount) {
        if (interest.getStatus() == JobInterest.Status.NOT_SELECTED) {
            return "Esta candidatura foi encerrada: a conversa fica só para leitura.";
        }
        if (messageCount == 0 && !isStudio(interest, user)) {
            return "Quem começa a conversa é o estúdio.";
        }
        return null;
    }

    private Conversation toConversation(JobInterest interest, User viewer) {
        List<JobInterestMessage> messages = messageRepository.findByInterestOrderByIdAsc(interest);
        List<CallMessage> items = messages.stream()
                .map(message -> new CallMessage(message.getId(), UserSummary.from(message.getAuthor()),
                        ProjectAccessService.sameUser(message.getAuthor(), viewer), message.getBody(),
                        message.getCreatedAt()))
                .toList();
        String blocked = blockedReason(interest, viewer, messages.size());
        return new Conversation(items, blocked == null, blocked);
    }

    private void notify(User to, String message, String link) {
        Notification notification = new Notification();
        notification.setUser(to);
        notification.setType("CALL_MESSAGE");
        notification.setMessage(message.length() > 480 ? message.substring(0, 480) : message);
        notification.setLink(link);
        notificationRepository.save(notification);
    }
}
