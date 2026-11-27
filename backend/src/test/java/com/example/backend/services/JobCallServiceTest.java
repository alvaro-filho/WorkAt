package com.example.backend.services;

import com.example.backend.config.BusinessTime;
import com.example.backend.dto.JobCallDtos.CallRequest;
import com.example.backend.models.JobCall;
import com.example.backend.models.JobInterest;
import com.example.backend.models.Notification;
import com.example.backend.models.Post;
import com.example.backend.models.PostKind;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectType;
import com.example.backend.models.Role;
import com.example.backend.models.User;
import com.example.backend.repositories.JobCallRepository;
import com.example.backend.repositories.JobInterestRepository;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.PostRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class JobCallServiceTest {

    private JobCallRepository callRepository;
    private JobInterestRepository interestRepository;
    private PostRepository postRepository;
    private ProjectService projectService;
    private ProjectMembershipService membershipService;
    private NotificationRepository notificationRepository;
    private JobCallService service;
    private User studio;
    private User artist;
    private JobCall call;

    @BeforeEach
    void setUp() {
        callRepository = mock(JobCallRepository.class);
        interestRepository = mock(JobInterestRepository.class);
        postRepository = mock(PostRepository.class);
        ProjectRepository projectRepository = mock(ProjectRepository.class);
        projectService = mock(ProjectService.class);
        membershipService = mock(ProjectMembershipService.class);
        notificationRepository = mock(NotificationRepository.class);
        service = new JobCallService(callRepository, interestRepository, postRepository, projectRepository,
                mock(UserRepository.class), mock(PostService.class), projectService, membershipService,
                notificationRepository);

        studio = user(1L, "Estúdio", Role.COMPANY);
        artist = user(2L, "Ana", Role.ARTIST);
        call = new JobCall();
        call.setId(10L);
        call.setAuthor(studio);
        call.setTitle("Concept de criaturas");
        call.setDescription("Criaturas para um jogo mobile, estilo cartoon.");
        call.setRole(JobCall.Role.CONCEPT);
        call.setFormat(JobCall.Format.FREELA);
        call.setLocation(JobCall.Location.REMOTO);
        call.setClosesOn(BusinessTime.today().plusDays(10));
        when(callRepository.findById(10L)).thenReturn(Optional.of(call));
        when(callRepository.save(any(JobCall.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(interestRepository.save(any(JobInterest.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(interestRepository.findByCallAndArtist(any(), any())).thenReturn(Optional.empty());
        when(projectRepository.findByCreatedByUser(any())).thenReturn(List.of());
    }

    @Test
    void onlyCompanyAccountsPublish() {
        assertEquals(403, status(() -> service.create(artist, request(BusinessTime.today().plusDays(5)))));
        assertNotNull(service.create(studio, request(BusinessTime.today().plusDays(5))));
    }

    @Test
    void atMostFiveOpenCallsAndDeadlineMustBeAhead() {
        assertEquals(400, status(() -> service.create(studio, request(BusinessTime.today().minusDays(1)))));
        when(callRepository.countOpenBy(eq(studio), any())).thenReturn(5L);
        assertEquals(409, status(() -> service.create(studio, request(BusinessTime.today().plusDays(5)))));
    }

    @Test
    void payIsOptionalButMinCannotExceedMax() {
        CallRequest noPay = request(BusinessTime.today().plusDays(5));
        assertNull(service.create(studio, noPay).payMin());
        CallRequest wrong = new CallRequest("Concept de criaturas", JobCall.Role.CONCEPT,
                "Criaturas para um jogo mobile, estilo cartoon.", JobCall.Format.FREELA, JobCall.Location.REMOTO,
                null, 3000, 1000, BusinessTime.today().plusDays(5), false, null);
        assertEquals(400, status(() -> service.create(studio, wrong)));
    }

    @Test
    void artistShowsInterestWithOwnPublicWorkAndStudioIsNotified() {
        Post work = new Post();
        work.setId(50L);
        work.setAuthor(artist);
        work.setKind(PostKind.STANDALONE);
        when(postRepository.findById(50L)).thenReturn(Optional.of(work));

        service.interest(10L, artist, "Adoro criaturas, segue meu portfólio.", List.of(50L));

        ArgumentCaptor<JobInterest> saved = ArgumentCaptor.forClass(JobInterest.class);
        verify(interestRepository).save(saved.capture());
        assertEquals(List.of(50L), saved.getValue().getWorkPostIds());
        ArgumentCaptor<Notification> notice = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(notice.capture());
        assertSame(studio, notice.getValue().getUser());
        assertEquals("CALL_INTEREST", notice.getValue().getType());
    }

    @Test
    void cannotUseSomeoneElsesWorkOrApplyTwice() {
        Post others = new Post();
        others.setId(51L);
        others.setAuthor(user(3L, "Beto", Role.ARTIST));
        others.setKind(PostKind.STANDALONE);
        when(postRepository.findById(51L)).thenReturn(Optional.of(others));
        assertEquals(400, status(() -> service.interest(10L, artist, "Oi", List.of(51L))));

        when(interestRepository.findByCallAndArtist(call, artist)).thenReturn(Optional.of(new JobInterest()));
        assertEquals(409, status(() -> service.interest(10L, artist, "Oi de novo", List.of())));
    }

    @Test
    void companiesAndClosedCallsDoNotReceiveInterest() {
        assertEquals(403, status(() -> service.interest(10L, user(4L, "Outro estúdio", Role.COMPANY), "Oi", List.of())));
        call.setClosesOn(BusinessTime.today().minusDays(1));
        assertEquals(409, status(() -> service.interest(10L, artist, "Oi", List.of())));
        assertEquals(JobCall.Status.CLOSED, call.effectiveStatus(BusinessTime.today()));
    }

    @Test
    void onlyTheAuthorSeesInterests() {
        assertEquals(403, status(() -> service.interests(10L, artist)));
    }

    @Test
    void inviteCreatesACorporateProjectWithTheCallNdaAndSendsTheInvitation() {
        call.setNda(true);
        JobInterest interest = interest(70L);
        Project created = new Project();
        created.setId(90L);
        created.setType(ProjectType.CORPORATE);
        when(projectService.createProject(any(Project.class), eq(studio))).thenReturn(created);
        when(projectService.updateSettings(90L, studio, null, true, null, null)).thenReturn(created);

        var result = service.invite(10L, 70L, studio, null);

        assertEquals(90L, result.projectId());
        ArgumentCaptor<Project> draft = ArgumentCaptor.forClass(Project.class);
        verify(projectService).createProject(draft.capture(), eq(studio));
        assertEquals(ProjectType.CORPORATE, draft.getValue().getType());
        verify(projectService).updateSettings(90L, studio, null, true, null, null);
        verify(membershipService).invite(90L, studio, "ana@test.test");
        assertEquals(JobInterest.Status.INVITED, interest.getStatus());
    }

    @Test
    void declineNotifiesTheArtist() {
        JobInterest interest = interest(71L);
        service.decline(10L, 71L, studio);
        assertEquals(JobInterest.Status.NOT_SELECTED, interest.getStatus());
        verify(notificationRepository).save(any(Notification.class));
    }

    // ---- ajudantes ----

    private JobInterest interest(Long id) {
        JobInterest interest = new JobInterest();
        interest.setId(id);
        interest.setCall(call);
        interest.setArtist(artist);
        interest.setMessage("Oi");
        when(interestRepository.findById(id)).thenReturn(Optional.of(interest));
        return interest;
    }

    private static CallRequest request(LocalDate closesOn) {
        return new CallRequest("Concept de criaturas", JobCall.Role.CONCEPT,
                "Criaturas para um jogo mobile, estilo cartoon.", JobCall.Format.FREELA, JobCall.Location.REMOTO,
                null, null, null, closesOn, false, null);
    }

    private static User user(Long id, String name, Role role) {
        User user = new User();
        user.setId(id);
        user.setFullName(name);
        user.setRole(role);
        user.setEmail(name.toLowerCase().replace("ú", "u") + "@test.test");
        user.setUsername(name.toLowerCase());
        return user;
    }

    private static int status(Runnable action) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, action::run);
        return error.getStatusCode().value();
    }
}
