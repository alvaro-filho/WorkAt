package com.example.backend.services;

import com.example.backend.models.InvitationStatus;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectInvitation;
import com.example.backend.models.ProjectMember;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.ProjectType;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectInvitationRepository;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.ProjectRepository;
import com.example.backend.repositories.TaskRepository;
import com.example.backend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ProjectMembershipServiceTest {
    private ProjectMemberRepository memberRepository;
    private ProjectInvitationRepository invitationRepository;
    private UserRepository userRepository;
    private TaskRepository taskRepository;
    private ProjectMembershipService service;

    private User owner;
    private User friend;
    private Project project;

    @BeforeEach
    void setUp() {
        ProjectRepository projectRepository = mock(ProjectRepository.class);
        memberRepository = mock(ProjectMemberRepository.class);
        invitationRepository = mock(ProjectInvitationRepository.class);
        userRepository = mock(UserRepository.class);
        taskRepository = mock(TaskRepository.class);
        service = new ProjectMembershipService(new ProjectAccessService(projectRepository, memberRepository),
                memberRepository, invitationRepository, userRepository, taskRepository);

        owner = user(1L, "dono@test.test");
        friend = user(2L, "amigo@test.test");
        project = new Project();
        project.setId(60L);
        project.setCreatedByUser(owner);
        project.setType(ProjectType.COOPERATIVE);

        when(projectRepository.findById(60L)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("amigo@test.test")).thenReturn(Optional.of(friend));
        when(userRepository.findByEmail("dono@test.test")).thenReturn(Optional.of(owner));
        when(invitationRepository.save(any(ProjectInvitation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void ownerInvitesExistingAccountByEmail() {
        ProjectInvitation invitation = service.invite(60L, owner, "  Amigo@test.test ");

        assertSame(friend, invitation.getInvitedUser());
        assertSame(owner, invitation.getInvitedBy());
        assertEquals(InvitationStatus.PENDING, invitation.getStatus());
    }

    @Test
    void personalProjectDoesNotAcceptInvitations() {
        project.setType(ProjectType.PERSONAL);

        assertEquals(400, statusOf(() -> service.invite(60L, owner, "amigo@test.test")));
        verify(invitationRepository, never()).save(any());
    }

    @Test
    void memberCannotInvite() {
        when(memberRepository.existsByProjectAndUser(project, friend)).thenReturn(true);

        assertEquals(403, statusOf(() -> service.invite(60L, friend, "dono@test.test")));
    }

    @Test
    void unknownEmailReturns404() {
        assertEquals(404, statusOf(() -> service.invite(60L, owner, "ninguem@test.test")));
    }

    @Test
    void cannotInviteYourselfOrSomeoneAlreadyInside() {
        assertEquals(400, statusOf(() -> service.invite(60L, owner, "dono@test.test")));

        when(memberRepository.existsByProjectAndUser(project, friend)).thenReturn(true);
        assertEquals(409, statusOf(() -> service.invite(60L, owner, "amigo@test.test")));
    }

    @Test
    void duplicatePendingInvitationReturns409() {
        ProjectInvitation pending = new ProjectInvitation();
        pending.setProject(project);
        pending.setInvitedUser(friend);
        pending.setStatus(InvitationStatus.PENDING);
        when(invitationRepository.findByProjectAndStatusOrderByCreatedAtDesc(project, InvitationStatus.PENDING))
                .thenReturn(List.of(pending));

        assertEquals(409, statusOf(() -> service.invite(60L, owner, "amigo@test.test")));
    }

    @Test
    void expiredInvitationCannotBeAcceptedAndIsMarkedExpired() {
        ProjectInvitation invitation = pendingInvitation();
        invitation.setCreatedAt(java.time.LocalDateTime.now().minusDays(ProjectMembershipService.INVITE_TTL_DAYS + 1));

        assertEquals(410, statusOf(() -> service.accept(90L, friend)));
        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());
        verify(memberRepository, never()).save(any());
    }

    @Test
    void ownerCancelsPendingInvitation() {
        ProjectInvitation invitation = pendingInvitation();
        when(invitationRepository.findById(90L)).thenReturn(java.util.Optional.of(invitation));

        service.cancelInvitation(60L, 90L, owner);

        assertEquals(InvitationStatus.CANCELLED, invitation.getStatus());
        assertEquals(410, statusOf(() -> service.accept(90L, friend)));
    }

    @Test
    void closedProjectDoesNotAcceptInvitations() {
        project.setStatus(ProjectStatus.CLOSED);

        assertEquals(409, statusOf(() -> service.invite(60L, owner, "amigo@test.test")));
    }

    @Test
    void acceptingCreatesMembership() {
        ProjectInvitation invitation = pendingInvitation();

        ProjectInvitation accepted = service.accept(90L, friend);

        assertEquals(InvitationStatus.ACCEPTED, accepted.getStatus());
        assertNotNull(accepted.getRespondedAt());
        verify(memberRepository).save(argThat(member ->
                member.getProject() == project && member.getUser() == friend));
        assertSame(invitation, accepted);
    }

    @Test
    void decliningDoesNotCreateMembership() {
        pendingInvitation();

        assertEquals(InvitationStatus.DECLINED, service.decline(90L, friend).getStatus());
        verify(memberRepository, never()).save(any());
    }

    @Test
    void cannotAnswerTheSameInvitationTwice() {
        pendingInvitation().setStatus(InvitationStatus.DECLINED);

        assertEquals(409, statusOf(() -> service.accept(90L, friend)));
    }

    @Test
    void cannotAnswerSomeoneElsesInvitation() {
        assertEquals(404, statusOf(() -> service.accept(90L, owner)));
    }

    @Test
    void memberLeavesTheProject() {
        ProjectMember membership = new ProjectMember(project, friend);
        when(memberRepository.existsByProjectAndUser(project, friend)).thenReturn(true);
        when(memberRepository.findByProjectAndUser(project, friend)).thenReturn(Optional.of(membership));

        service.leave(60L, friend);

        verify(memberRepository).delete(membership);
        verify(taskRepository).unassignAllInProject(project, friend);
    }

    @Test
    void removedMemberStopsBeingAssigneeOfTheirTasks() {
        ProjectMember membership = new ProjectMember(project, friend);
        when(memberRepository.findByProjectOrderByJoinedAtAsc(project)).thenReturn(List.of(membership));

        service.removeMember(60L, 2L, owner);

        verify(memberRepository).delete(membership);
        verify(taskRepository).unassignAllInProject(project, friend);
    }

    @Test
    void invitesAccountRegisteredWithMixedCaseEmail() {
        User legacy = user(3L, "Colega@Test.test");
        when(userRepository.findAllByEmailIgnoreCase("colega@test.test")).thenReturn(List.of(legacy));

        assertSame(legacy, service.invite(60L, owner, "colega@test.test").getInvitedUser());
    }

    @Test
    void ownerCannotLeaveOwnProject() {
        assertEquals(400, statusOf(() -> service.leave(60L, owner)));
    }

    private ProjectInvitation pendingInvitation() {
        ProjectInvitation invitation = new ProjectInvitation();
        invitation.setId(90L);
        invitation.setProject(project);
        invitation.setInvitedUser(friend);
        invitation.setInvitedBy(owner);
        invitation.setStatus(InvitationStatus.PENDING);
        when(invitationRepository.findByIdAndInvitedUser(90L, friend)).thenReturn(Optional.of(invitation));
        return invitation;
    }

    private static int statusOf(Runnable action) {
        return assertThrows(ResponseStatusException.class, action::run).getStatusCode().value();
    }

    private static User user(Long id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        return user;
    }

    @Test
    void invitesByUsernameWhenThePersonAllowsIt() {
        friend.setUsername("ana_artista");
        when(userRepository.findByUsername("ana_artista")).thenReturn(Optional.of(friend));

        ProjectInvitation invitation = service.invite(60L, owner, "@ana_artista");

        assertSame(friend, invitation.getInvitedUser());
    }

    @Test
    void usernameInviteIsRefusedWhenThePersonOnlyAcceptsEmail() {
        friend.setUsername("ana_artista");
        friend.setInviteByUsername(false);
        when(userRepository.findByUsername("ana_artista")).thenReturn(Optional.of(friend));

        assertEquals(403, statusOf(() -> service.invite(60L, owner, "@ana_artista")));
        // Pelo e-mail continua funcionando.
        assertSame(friend, service.invite(60L, owner, "amigo@test.test").getInvitedUser());
    }

    @Test
    void unknownUsernameIsNotFound() {
        when(userRepository.findByUsername("ninguem")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("ninguem")).thenReturn(Optional.empty());

        assertEquals(404, statusOf(() -> service.invite(60L, owner, "@ninguem")));
    }
}
