package com.example.backend.controllers;

import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.TaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ValidationExceptionHandlerTest {
    private MockMvc exceptionControllerMvc;
    private MockMvc taskControllerMvc;

    @BeforeEach
    void setUp() {
        ValidationExceptionHandler advice = new ValidationExceptionHandler();
        exceptionControllerMvc = MockMvcBuilders.standaloneSetup(new ThrowingController())
                .setControllerAdvice(advice).build();

        UserRepository userRepository = mock(UserRepository.class);
        User user = new User();
        when(userRepository.findByEmail("owner@example.test")).thenReturn(Optional.of(user));
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        taskControllerMvc = MockMvcBuilders.standaloneSetup(new TaskController(mock(TaskService.class), userRepository))
                .setControllerAdvice(advice)
                .setValidator(validator)
                .build();
    }

    @Test
    void responseStatusExceptionPreservesNotFoundAndMessage() throws Exception {
        exceptionControllerMvc.perform(get("/test/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Projeto não encontrado."));
    }

    @Test
    void responseStatusExceptionWithoutReasonUsesStatusPhrase() throws Exception {
        exceptionControllerMvc.perform(get("/test/unauthorized"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Unauthorized"));
    }

    @Test
    void invalidStatusEnumReturnsSafeBadRequestMessage() throws Exception {
        taskControllerMvc.perform(patch("/api/v1/tasks/4/status")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"FEITO\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "Requisição inválida: verifique os campos e os valores permitidos."));
    }

    @Test
    void invalidPriorityEnumReturnsSafeBadRequestMessage() throws Exception {
        taskControllerMvc.perform(post("/api/v1/projects/7/tasks")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Teste\",\"priority\":\"URGENTE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "Requisição inválida: verifique os campos e os valores permitidos."));
    }

    @Test
    void blankTitleKeepsExistingValidationMessage() throws Exception {
        taskControllerMvc.perform(post("/api/v1/projects/7/tasks")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("O título é obrigatório."));
    }

    @RestController
    static class ThrowingController {
        @GetMapping("/test/not-found")
        void notFound() {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Projeto não encontrado.");
        }

        @GetMapping("/test/unauthorized")
        void unauthorized() {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
    }
}
