package com.example.backend.dto;

import com.example.backend.controllers.ProjectController;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectRole;
import com.example.backend.models.ProjectType;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.UserRepository;
import com.example.backend.services.ProjectService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProjectCreateRequestTest {

    @Test
    void clientIdentityFieldsCannotControlTheNewProjectOrItsCreator() throws Exception {
        String json = """
                {
                  "id": 918273,
                  "name": "Campaign",
                  "slug": "campaign",
                  "description": "Description",
                  "type": "CORPORATE",
                  "createdByUser": {"id": 7654321}
                }
                """;
        ProjectCreateRequest request = new ObjectMapper().readValue(json, ProjectCreateRequest.class);

        User authenticatedCreator = new User();
        authenticatedCreator.setEmail("artist@example.test");
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByEmail("artist@example.test"))
                .thenReturn(Optional.of(authenticatedCreator));

        ProjectRepository projectRepository = mock(ProjectRepository.class);
        when(projectRepository.save(any(Project.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        var memberRepository = mock(com.example.backend.repositories.ProjectMemberRepository.class);
        ProjectService projectService = new ProjectService(projectRepository,
                mock(com.example.backend.repositories.TaskRepository.class),
                mock(com.example.backend.repositories.ActivityEventRepository.class),
                memberRepository,
                mock(com.example.backend.repositories.ProjectInvitationRepository.class),
                new com.example.backend.services.ProjectAccessService(projectRepository, memberRepository),
                mock(com.example.backend.services.TaskFileService.class));
        ProjectController controller = new ProjectController(projectService,
                mock(com.example.backend.services.ProjectMembershipService.class), userRepository);

        var authentication = new UsernamePasswordAuthenticationToken(
                "artist@example.test", null, List.of());
        ResponseEntity<ProjectResponse> response = controller.createProject(request, authentication);

        assertEquals(201, response.getStatusCode().value());
        org.mockito.ArgumentCaptor<Project> projectCaptor =
                org.mockito.ArgumentCaptor.forClass(Project.class);
        verify(projectRepository).save(projectCaptor.capture());
        Project savedProject = projectCaptor.getValue();

        assertNotNull(response.getBody());
        assertEquals(ProjectRole.OWNER, response.getBody().myRole());
        assertEquals(ProjectType.CORPORATE, response.getBody().type());
        assertNull(savedProject.getId());
        assertSame(authenticatedCreator, savedProject.getCreatedByUser());
        assertEquals("Campaign", savedProject.getName());
        assertEquals("campaign", savedProject.getSlug());
        assertEquals("Description", savedProject.getDescription());
        assertEquals(ProjectType.CORPORATE, savedProject.getType());
        verify(projectRepository, never()).findById(918273L);
    }
}
