package com.example.backend.controllers;

import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.ProfileService;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

class ProfileControllerTest {

    @Test
    void visitorWithoutLoginSeesTheProfileAsAnonymous() {
        ProfileService profileService = mock(ProfileService.class);
        ProfileController controller = new ProfileController(profileService, mock(UserRepository.class));

        controller.profile("bia", null);

        verify(profileService).profile(eq("bia"), isNull());
    }

    @Test
    void loggedInViewerIsPassedAlong() {
        ProfileService profileService = mock(ProfileService.class);
        UserRepository userRepository = mock(UserRepository.class);
        User viewer = new User();
        viewer.setEmail("eva@workat.test");
        when(userRepository.findByEmail("eva@workat.test")).thenReturn(Optional.of(viewer));
        ProfileController controller = new ProfileController(profileService, userRepository);

        controller.profile("bia", new UsernamePasswordAuthenticationToken("eva@workat.test", null, List.of()));

        verify(profileService).profile("bia", viewer);
    }
}
