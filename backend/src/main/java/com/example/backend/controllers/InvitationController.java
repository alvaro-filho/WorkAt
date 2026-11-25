package com.example.backend.controllers;

import com.example.backend.dto.InvitationResponse;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.ProjectMembershipService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Convites recebidos pelo usuário logado.
 */
@RestController
@RequestMapping("/api/v1/invitations")
public class InvitationController {

    private final ProjectMembershipService membershipService;
    private final UserRepository userRepository;

    public InvitationController(ProjectMembershipService membershipService, UserRepository userRepository) {
        this.membershipService = membershipService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<InvitationResponse>> myInvitations(Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(membershipService.myPendingInvitations(user).stream()
                .map(InvitationResponse::from).toList());
    }

    @PostMapping("/{invitationId}/accept")
    public ResponseEntity<InvitationResponse> accept(@PathVariable Long invitationId, Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(InvitationResponse.from(membershipService.accept(invitationId, user)));
    }

    @PostMapping("/{invitationId}/decline")
    public ResponseEntity<InvitationResponse> decline(@PathVariable Long invitationId, Authentication authentication) {
        User user = findAuthenticatedUser(authentication);
        return ResponseEntity.ok(InvitationResponse.from(membershipService.decline(invitationId, user)));
    }

    private User findAuthenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário autenticado não identificado.");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Usuário autenticado não encontrado."));
    }
}
