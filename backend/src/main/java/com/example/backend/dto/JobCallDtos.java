package com.example.backend.dto;

import com.example.backend.models.JobCall;
import com.example.backend.models.JobInterest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Respostas e pedidos das Chamadas (vagas/jobs) e dos interesses dos artistas. */
public final class JobCallDtos {

    private JobCallDtos() {
    }

    /**
     * Chamada como aparece no Explorar e na página dela.
     * authorSince e directedProjects: sinais de confiança sobre o estúdio (há quanto tempo está aqui, quantos
     * projetos corporativos dirige). interestCount: só para o autor. myInterest: a candidatura de quem está vendo.
     */
    public record CallResponse(Long id, String title, JobCall.Role role, String description, JobCall.Format format,
                               JobCall.Location location, String city, Integer payMin, Integer payMax,
                               LocalDate closesOn, boolean nda, JobCall.Status status, LocalDateTime createdAt,
                               UserSummary author, LocalDateTime authorSince, int directedProjects,
                               boolean mine, Long interestCount, MyInterest myInterest) {
    }

    /** messageCount: mensagens na conversa com o estúdio (o artista só escreve depois que o estúdio começa). */
    public record MyInterest(Long id, JobInterest.Status status, Long projectId, long messageCount) {
    }

    /** Candidatura vista pelo estúdio: o artista, a mensagem e os trabalhos escolhidos. */
    public record InterestResponse(Long id, UserSummary artist, String message, JobInterest.Status status,
                                   LocalDateTime createdAt, List<PostResponse> works, Long projectId,
                                   long messageCount) {
    }

    /** Candidatura vista pelo próprio artista (Minhas candidaturas). */
    public record MyInterestItem(Long id, JobInterest.Status status, LocalDateTime createdAt, Long projectId,
                                 Long callId, String callTitle, UserSummary company, JobCall.Status callStatus,
                                 long messageCount) {
    }

    public record CallRequest(String title, JobCall.Role role, String description, JobCall.Format format,
                              JobCall.Location location, String city, Integer payMin, Integer payMax,
                              LocalDate closesOn, Boolean nda, JobCall.Status status) {
    }

    public record InterestRequest(String message, List<Long> postIds) {
    }

    public record InviteRequest(Long projectId) {
    }

    public record InviteResult(Long projectId, InterestResponse interest) {
    }

    /** Uma mensagem da conversa da Chamada. mine: foi quem está vendo que escreveu. */
    public record CallMessage(Long id, UserSummary author, boolean mine, String body, LocalDateTime createdAt) {
    }

    /** Conversa entre o estúdio e um candidato. canSend false vem com o motivo (blockedReason). */
    public record Conversation(List<CallMessage> messages, boolean canSend, String blockedReason) {
    }

    public record MessageRequest(String body) {
    }
}
