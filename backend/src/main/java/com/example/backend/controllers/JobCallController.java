package com.example.backend.controllers;

import com.example.backend.dto.JobCallDtos.CallRequest;
import com.example.backend.dto.JobCallDtos.CallResponse;
import com.example.backend.dto.JobCallDtos.Conversation;
import com.example.backend.dto.JobCallDtos.InterestRequest;
import com.example.backend.dto.JobCallDtos.InterestResponse;
import com.example.backend.dto.JobCallDtos.InviteRequest;
import com.example.backend.dto.JobCallDtos.InviteResult;
import com.example.backend.dto.JobCallDtos.MessageRequest;
import com.example.backend.dto.JobCallDtos.MyInterestItem;
import com.example.backend.models.JobCall;
import com.example.backend.services.CurrentUser;
import com.example.backend.services.JobCallMessageService;
import com.example.backend.services.JobCallService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Chamadas (vagas e jobs): ler é público; publicar, manifestar interesse e responder exigem login. */
@RestController
public class JobCallController {

    private final JobCallService calls;
    private final JobCallMessageService messages;
    private final CurrentUser currentUser;

    public JobCallController(JobCallService calls, JobCallMessageService messages, CurrentUser currentUser) {
        this.calls = calls;
        this.messages = messages;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/v1/calls")
    public List<CallResponse> list(@RequestParam(required = false) JobCall.Role role,
                                   @RequestParam(required = false) JobCall.Format format,
                                   @RequestParam(required = false) JobCall.Location location,
                                   @RequestParam(required = false) String author,
                                   Authentication authentication) {
        return calls.list(role, format, location, author, currentUser.optional(authentication));
    }

    @PostMapping("/api/v1/calls")
    public ResponseEntity<CallResponse> create(@RequestBody CallRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(calls.create(currentUser.require(authentication), request));
    }

    @GetMapping("/api/v1/calls/{id}")
    public CallResponse get(@PathVariable Long id, Authentication authentication) {
        return calls.get(id, currentUser.optional(authentication));
    }

    @PatchMapping("/api/v1/calls/{id}")
    public CallResponse update(@PathVariable Long id, @RequestBody CallRequest request, Authentication authentication) {
        return calls.update(id, currentUser.require(authentication), request);
    }

    @PostMapping("/api/v1/calls/{id}/interest")
    public CallResponse interest(@PathVariable Long id, @RequestBody InterestRequest request,
                                 Authentication authentication) {
        return calls.interest(id, currentUser.require(authentication),
                request == null ? null : request.message(), request == null ? null : request.postIds());
    }

    @DeleteMapping("/api/v1/calls/{id}/interest")
    public CallResponse withdraw(@PathVariable Long id, Authentication authentication) {
        return calls.withdraw(id, currentUser.require(authentication));
    }

    @GetMapping("/api/v1/calls/{id}/interests")
    public List<InterestResponse> interests(@PathVariable Long id, Authentication authentication) {
        return calls.interests(id, currentUser.require(authentication));
    }

    @PostMapping("/api/v1/calls/{id}/interests/{interestId}/invite")
    public InviteResult invite(@PathVariable Long id, @PathVariable Long interestId,
                               @RequestBody(required = false) InviteRequest request, Authentication authentication) {
        return calls.invite(id, interestId, currentUser.require(authentication),
                request == null ? null : request.projectId());
    }

    @PostMapping("/api/v1/calls/{id}/interests/{interestId}/decline")
    public InterestResponse decline(@PathVariable Long id, @PathVariable Long interestId,
                                    Authentication authentication) {
        return calls.decline(id, interestId, currentUser.require(authentication));
    }

    /** Conversa da Chamada: só o estúdio que publicou e o artista daquela candidatura. */
    @GetMapping("/api/v1/calls/{id}/interests/{interestId}/messages")
    public Conversation conversation(@PathVariable Long id, @PathVariable Long interestId,
                                     Authentication authentication) {
        return messages.conversation(id, interestId, currentUser.require(authentication));
    }

    @PostMapping("/api/v1/calls/{id}/interests/{interestId}/messages")
    public Conversation send(@PathVariable Long id, @PathVariable Long interestId,
                             @RequestBody(required = false) MessageRequest request, Authentication authentication) {
        return messages.send(id, interestId, currentUser.require(authentication),
                request == null ? null : request.body());
    }

    @GetMapping("/api/v1/me/interests")
    public List<MyInterestItem> myInterests(Authentication authentication) {
        return calls.myInterests(currentUser.require(authentication));
    }
}
