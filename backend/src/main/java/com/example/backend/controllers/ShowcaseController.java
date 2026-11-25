package com.example.backend.controllers;

import com.example.backend.dto.NdaStatusUpdateRequest;
import com.example.backend.dto.PublicShowcaseResponse;
import com.example.backend.dto.ShowcaseCreateRequest;
import com.example.backend.dto.ShowcaseResponse;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.ShowcaseService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/v1/showcase")
public class ShowcaseController {
    private final ShowcaseService showcaseService;
    private final UserRepository userRepository;

    public ShowcaseController(ShowcaseService showcaseService, UserRepository userRepository) {
        this.showcaseService = showcaseService;
        this.userRepository = userRepository;
    }

    @PostMapping
    @PreAuthorize("hasRole('ARTIST')")
    public ResponseEntity<ShowcaseResponse> create(@RequestBody ShowcaseCreateRequest request,
                                                   Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ShowcaseResponse.from(
                showcaseService.create(request, authenticatedUser(authentication))));
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('ARTIST')")
    public List<ShowcaseResponse> mine(Authentication authentication) {
        return showcaseService.mine(authenticatedUser(authentication)).stream().map(ShowcaseResponse::from).toList();
    }

    @GetMapping("/inbox")
    @PreAuthorize("hasRole('COMPANY')")
    public List<ShowcaseResponse> inbox(Authentication authentication) {
        return showcaseService.inbox(authenticatedUser(authentication)).stream().map(ShowcaseResponse::from).toList();
    }

    // Quem libera é a parte contratante (dono do projeto), que pode ser estúdio ou artista: o serviço confere.
    @PatchMapping("/{id}/nda-status")
    public ShowcaseResponse updateNdaStatus(@PathVariable Long id, @RequestBody NdaStatusUpdateRequest request,
                                            Authentication authentication) {
        return ShowcaseResponse.from(showcaseService.updateNdaStatus(
                id, request, authenticatedUser(authentication)));
    }

    @GetMapping("/public")
    public List<PublicShowcaseResponse> publicArts() {
        return showcaseService.publicArts().stream().map(PublicShowcaseResponse::from).toList();
    }

    private User authenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário autenticado não identificado.");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Usuário autenticado não encontrado."));
    }
}
