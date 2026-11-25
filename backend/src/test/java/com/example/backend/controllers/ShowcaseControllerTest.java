package com.example.backend.controllers;

import com.example.backend.dto.ShowcaseCreateRequest;
import com.example.backend.models.Role;
import com.example.backend.models.ShowcaseArt;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.ShowcaseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ShowcaseControllerTest {
    private MockMvc mockMvc;
    private ShowcaseService showcaseService;
    private UserRepository userRepository;
    private User artist;
    private User company;

    @BeforeEach
    void setUp() {
        showcaseService = mock(ShowcaseService.class);
        userRepository = mock(UserRepository.class);
        artist = user("artist@test.test", "Artist", Role.ARTIST);
        company = user("company@test.test", "Company", Role.COMPANY);
        when(userRepository.findByEmail("artist@test.test")).thenReturn(Optional.of(artist));
        when(userRepository.findByEmail("company@test.test")).thenReturn(Optional.of(company));
        mockMvc = MockMvcBuilders.standaloneSetup(new ShowcaseController(showcaseService, userRepository))
                .setControllerAdvice(new ValidationExceptionHandler()).build();
    }

    @Test
    void createReturns201DtoWithoutSerializingEntities() throws Exception {
        ShowcaseArt art = new ShowcaseArt();
        art.setId(5L);
        art.setTitle("Artwork");
        art.setArtist(artist);
        art.setCompany(company);
        when(showcaseService.create(any(ShowcaseCreateRequest.class), eq(artist))).thenReturn(art);

        mockMvc.perform(post("/api/v1/showcase")
                        .principal(auth("artist@test.test"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Artwork\",\"companyEmail\":\"company@test.test\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.ndaStatus").value("LOCKED_BY_NDA"))
                .andExpect(jsonPath("$.artistName").value("Artist"))
                .andExpect(jsonPath("$.companyName").value("Company"))
                .andExpect(jsonPath("$.artist").doesNotExist())
                .andExpect(jsonPath("$.company").doesNotExist());
    }

    @Test
    void createReturns400ForInvalidCompany() throws Exception {
        when(showcaseService.create(any(ShowcaseCreateRequest.class), eq(artist)))
                .thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                        "Empresa contratante não encontrada."));

        mockMvc.perform(post("/api/v1/showcase")
                        .principal(auth("artist@test.test"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Artwork\",\"companyEmail\":\"unknown@test.test\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Empresa contratante não encontrada."));
    }

    @Test
    void updateReturns404ForNonRecipient() throws Exception {
        when(showcaseService.updateNdaStatus(eq(5L), any(), eq(company)))
                .thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,
                        "Arte não encontrada."));

        mockMvc.perform(patch("/api/v1/showcase/5/nda-status")
                        .principal(auth("company@test.test"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED_FOR_RELEASE\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Arte não encontrada."));
    }

    private UsernamePasswordAuthenticationToken auth(String email) {
        return new UsernamePasswordAuthenticationToken(email, null);
    }

    private User user(String email, String name, Role role) {
        User user = new User();
        user.setEmail(email);
        user.setFullName(name);
        user.setRole(role);
        return user;
    }
}
