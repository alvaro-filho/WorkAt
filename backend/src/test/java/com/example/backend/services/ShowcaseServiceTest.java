package com.example.backend.services;

import com.example.backend.dto.NdaStatusUpdateRequest;
import com.example.backend.dto.ShowcaseCreateRequest;
import com.example.backend.models.NdaStatus;
import com.example.backend.models.Project;
import com.example.backend.models.Role;
import com.example.backend.models.ShowcaseArt;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.ShowcaseArtRepository;
import com.example.backend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ShowcaseServiceTest {
    private ShowcaseArtRepository showcaseArtRepository;
    private UserRepository userRepository;
    private ProjectRepository projectRepository;
    private ShowcaseService service;
    private User artist;
    private User company;

    @BeforeEach
    void setUp() {
        showcaseArtRepository = mock(ShowcaseArtRepository.class);
        userRepository = mock(UserRepository.class);
        projectRepository = mock(ProjectRepository.class);
        service = new ShowcaseService(showcaseArtRepository, userRepository, projectRepository);
        artist = user("Artist", Role.ARTIST);
        company = user("Company", Role.COMPANY);
        when(userRepository.findByEmail("company@test.test")).thenReturn(Optional.of(company));
        when(showcaseArtRepository.save(any(ShowcaseArt.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void newArtworkStartsLockedAndUsesOwnedProject() {
        Project project = new Project();
        project.setId(41L);
        when(projectRepository.findByIdAndCreatedByUser(41L, artist)).thenReturn(Optional.of(project));
        ShowcaseCreateRequest request = createRequest();
        request.setProjectId(41L);

        ShowcaseArt art = service.create(request, artist);

        assertEquals(NdaStatus.LOCKED_BY_NDA, art.getNdaStatus());
        assertSame(artist, art.getArtist());
        assertSame(company, art.getCompany());
        assertSame(project, art.getProject());
        assertNull(art.getReviewNote());
    }

    @Test
    void rejectsMissingOrNonCompanyRecipient() {
        when(userRepository.findByEmail("artist@test.test")).thenReturn(Optional.of(artist));
        ShowcaseCreateRequest request = createRequest();
        request.setCompanyEmail("artist@test.test");

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.create(request, artist));

        assertEquals(400, exception.getStatusCode().value());
        assertEquals("Empresa contratante não encontrada.", exception.getReason());
        verify(showcaseArtRepository, never()).save(any());
    }

    @Test
    void rejectsUnownedProject() {
        when(projectRepository.findByIdAndCreatedByUser(41L, artist)).thenReturn(Optional.empty());
        ShowcaseCreateRequest request = createRequest();
        request.setProjectId(41L);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.create(request, artist));

        assertEquals(404, exception.getStatusCode().value());
        verify(showcaseArtRepository, never()).save(any());
    }

    @Test
    void onlyTheRecipientCanChangeNdaStatus() {
        when(showcaseArtRepository.findByIdAndCompany(9L, company)).thenReturn(Optional.empty());
        NdaStatusUpdateRequest request = statusRequest("APPROVED_FOR_RELEASE");

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.updateNdaStatus(9L, request, company));

        assertEquals(404, exception.getStatusCode().value());
        verify(showcaseArtRepository, never()).save(any());
    }

    @Test
    void rejectsMissingOrInvalidNdaStatus() {
        when(showcaseArtRepository.findByIdAndCompany(9L, company)).thenReturn(Optional.of(art()));

        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> service.updateNdaStatus(9L, new NdaStatusUpdateRequest(), company));
        assertEquals(400, missing.getStatusCode().value());

        NdaStatusUpdateRequest invalidRequest = statusRequest("PENDING");
        ResponseStatusException invalid = assertThrows(ResponseStatusException.class,
                () -> service.updateNdaStatus(9L, invalidRequest, company));
        assertEquals(400, invalid.getStatusCode().value());
        verify(showcaseArtRepository, never()).save(any());
    }

    @Test
    void lockingRequiresNoteAndClearsReleaseDate() {
        ShowcaseArt art = art();
        art.setNdaStatus(NdaStatus.APPROVED_FOR_RELEASE);
        art.setReleaseDate(LocalDate.now().plusDays(3));
        when(showcaseArtRepository.findByIdAndCompany(9L, company)).thenReturn(Optional.of(art));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.updateNdaStatus(9L, statusRequest("LOCKED_BY_NDA"), company));
        assertEquals(400, exception.getStatusCode().value());

        NdaStatusUpdateRequest request = statusRequest("LOCKED_BY_NDA");
        request.setNote("Contrato ainda vigente");
        ShowcaseArt locked = service.updateNdaStatus(9L, request, company);
        assertEquals(NdaStatus.LOCKED_BY_NDA, locked.getNdaStatus());
        assertNull(locked.getReleaseDate());
        assertEquals("Contrato ainda vigente", locked.getReviewNote());
    }

    @Test
    void approvalRejectsPastReleaseDateAndClearsReviewNote() {
        ShowcaseArt art = art();
        art.setReviewNote("Previously rejected");
        when(showcaseArtRepository.findByIdAndCompany(9L, company)).thenReturn(Optional.of(art));
        NdaStatusUpdateRequest request = statusRequest("APPROVED_FOR_RELEASE");
        request.setReleaseDate(LocalDate.now().minusDays(1));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.updateNdaStatus(9L, request, company));
        assertEquals(400, exception.getStatusCode().value());

        request.setReleaseDate(null);
        ShowcaseArt approved = service.updateNdaStatus(9L, request, company);
        assertEquals(NdaStatus.APPROVED_FOR_RELEASE, approved.getNdaStatus());
        assertNull(approved.getReleaseDate());
        assertNull(approved.getReviewNote());
    }

    @Test
    void publicQueryIsRestrictedToApprovedItemsReleasedByToday() {
        ShowcaseArt publicArt = art();
        publicArt.setNdaStatus(NdaStatus.APPROVED_FOR_RELEASE);
        when(showcaseArtRepository.findPublicArts(NdaStatus.APPROVED_FOR_RELEASE, LocalDate.now()))
                .thenReturn(List.of(publicArt));

        List<ShowcaseArt> results = service.publicArts();

        assertEquals(List.of(publicArt), results);
        verify(showcaseArtRepository).findPublicArts(NdaStatus.APPROVED_FOR_RELEASE, LocalDate.now());
    }

    private ShowcaseCreateRequest createRequest() {
        ShowcaseCreateRequest request = new ShowcaseCreateRequest();
        request.setTitle("Artwork");
        request.setCompanyEmail("company@test.test");
        return request;
    }

    private NdaStatusUpdateRequest statusRequest(String status) {
        NdaStatusUpdateRequest request = new NdaStatusUpdateRequest();
        request.setStatus(status);
        return request;
    }

    private ShowcaseArt art() {
        ShowcaseArt art = new ShowcaseArt();
        art.setId(9L);
        art.setTitle("Artwork");
        art.setArtist(artist);
        art.setCompany(company);
        return art;
    }

    private User user(String name, Role role) {
        User user = new User();
        user.setFullName(name);
        user.setEmail(role == Role.COMPANY ? "company@test.test" : "artist@test.test");
        user.setRole(role);
        return user;
    }
}
