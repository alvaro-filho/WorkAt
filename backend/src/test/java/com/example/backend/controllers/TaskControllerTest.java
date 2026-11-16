package com.example.backend.controllers;

import com.example.backend.dto.TaskCreateRequest;
import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.TaskPriority;
import com.example.backend.models.TaskStatus;
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.TaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TaskControllerTest {
    private MockMvc mockMvc;
    private TaskService taskService;
    private User creator;

    @BeforeEach
    void setUp() {
        taskService = mock(TaskService.class);
        UserRepository userRepository = mock(UserRepository.class);
        creator = new User();
        when(userRepository.findByEmail("owner@example.test")).thenReturn(Optional.of(creator));
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(new TaskController(taskService, userRepository))
                .setValidator(validator).setControllerAdvice(new ValidationExceptionHandler()).build();
    }

    @Test
    void createReturns201WithTaskResponse() throws Exception {
        Project project = new Project();
        project.setId(9L);
        Task task = new Task();
        task.setId(3L);
        task.setTitle("Draft");
        task.setPriority(TaskPriority.MEDIUM);
        task.setStatus(TaskStatus.TODO);
        task.setProject(project);
        when(taskService.createTask(eq(9L), eq(creator), any(TaskCreateRequest.class))).thenReturn(task);

        mockMvc.perform(post("/api/v1/projects/9/tasks")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Draft\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(3))
                .andExpect(jsonPath("$.projectId").value(9))
                .andExpect(jsonPath("$.status").value("TODO"))
                .andExpect(jsonPath("$.priority").value("MEDIUM"));
    }

    @Test
    void createReturns404WhenProjectIsNotOwned() throws Exception {
        when(taskService.createTask(eq(9L), eq(creator), any(TaskCreateRequest.class)))
                .thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND));

        mockMvc.perform(post("/api/v1/projects/9/tasks")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Draft\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void createReturns400ForBlankTitle() throws Exception {
        mockMvc.perform(post("/api/v1/projects/9/tasks")
                        .principal(() -> "owner@example.test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  \"}"))
                .andExpect(status().isBadRequest());

        verify(taskService, never()).createTask(any(), any(), any());
    }

    @Test
    void deleteReturns204() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/v1/tasks/12")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null)))
                .andExpect(status().isNoContent());

        verify(taskService).deleteTask(12L, creator);
    }

    @Test
    void deleteReturns409WhenProjectIsClosed() throws Exception {
        doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                "Projeto encerrado. Retome o projeto para alterar tarefas."))
                .when(taskService).deleteTask(12L, creator);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/v1/tasks/12")
                        .principal(new UsernamePasswordAuthenticationToken("owner@example.test", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Projeto encerrado. Retome o projeto para alterar tarefas."));
    }
}
