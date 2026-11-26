package com.example.backend.controllers;

import com.example.backend.dto.ProfileResponse;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.ProfileService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProfileController {

    private final ProfileService profileService;
    private final UserRepository userRepository;

    public ProfileController(ProfileService profileService, UserRepository userRepository) {
        this.profileService = profileService;
        this.userRepository = userRepository;
    }

    @GetMapping("/api/v1/users/{username}/profile")
    /** Público: quem não tem login vê o perfil como um visitante qualquer (NDA mascarado, pessoais escondidos). */
    public ProfileResponse profile(@PathVariable String username, Authentication authentication) {
        User viewer = authentication == null || authentication.getName() == null
                ? null
                : userRepository.findByEmail(authentication.getName()).orElse(null);
        return profileService.profile(username, viewer);
    }
}
