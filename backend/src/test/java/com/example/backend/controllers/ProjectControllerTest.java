package com.example.backend.controllers;

import com.example.backend.models.Project;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.ProjectMembershipService;
import com.example.backend.services.ProjectService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ProjectControllerTest {
    private MockMvc mockMvc;
    private ProjectService projectService;
    private User creator;

    @BeforeEach
    void setUp() {
        projectService = mock(ProjectService.class);
        UserRepository userRepository = mock(UserRepository.class);
        creator = new User();
        when(userRepository.findByEmail("owner@example.test")).thenReturn(Optional.of(creator));
        mockMvc = MockMvcBuilders.standaloneSetup(new ProjectController(projectService, mock(ProjectMembershipService.class), userRepository))
                .setControllerAdvice(new ValidationExceptionHandler()).build();
    }

    @Test
    void statusUpdateReturns200WithStatus() throws Exception {
        Project project = new Project();
        project.setId(8L);
        project.setName("Site");
        project.setSlug("site");
        project.setStatus(ProjectStatus.CLOSED);
        project.setCreatedByUser(creator);
        when(projectService.updateStatus(8L, creator, "CLOSED")).thenReturn(project);

        mockMvc.perform(patch("/api/v1/projects/8/status")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CLOSED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.myRole").value("OWNER"));
    }

    @Test
    void invalidStatusReturns400() throws Exception {
        when(projectService.updateStatus(8L, creator, "PAUSED")).thenThrow(new ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Status inválido. Use ACTIVE ou CLOSED."));

        mockMvc.perform(patch("/api/v1/projects/8/status")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PAUSED\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Status inválido. Use ACTIVE ou CLOSED."));
    }

    @Test
    void missingStatusReturns400() throws Exception {
        when(projectService.updateStatus(8L, creator, null)).thenThrow(new ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "O status é obrigatório. Use ACTIVE ou CLOSED."));

        mockMvc.perform(patch("/api/v1/projects/8/status")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("O status é obrigatório. Use ACTIVE ou CLOSED."));
    }

    @Test
    void deleteReturns204() throws Exception {
        mockMvc.perform(delete("/api/v1/projects/8")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null)))
                .andExpect(status().isNoContent());

        verify(projectService).deleteProject(8L, creator);
    }

    @Test
    void deleteActiveReturns409() throws Exception {
        doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                "Encerre o projeto antes de apagá-lo.")).when(projectService).deleteProject(8L, creator);

        mockMvc.perform(delete("/api/v1/projects/8")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Encerre o projeto antes de apagá-lo."));
    }
}
