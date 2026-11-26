package com.example.backend.services;

import com.example.backend.events.WorkEvent;
import com.example.backend.models.InvitationStatus;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectInvitation;
import com.example.backend.models.ProjectMember;
import com.example.backend.models.ProjectStatus;
import com.example.backend.models.ProjectType;
import com.example.backend.models.User;
import com.example.backend.repositories.ProjectInvitationRepository;
import com.example.backend.repositories.ProjectMemberRepository;
import com.example.backend.repositories.TaskRepository;
import com.example.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Participação em projetos: convites por e-mail, aceite/recusa, remoção de membro e saída do projeto.
 */
@Service
public class ProjectMembershipService {

    private final ProjectAccessService access;
    private final ProjectMemberRepository memberRepository;
    private final ProjectInvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final TaskRepository taskRepository;

    public ProjectMembershipService(ProjectAccessService access, ProjectMemberRepository memberRepository,
                                    ProjectInvitationRepository invitationRepository, UserRepository userRepository,
                                    TaskRepository taskRepository) {
        this.access = access;
        this.memberRepository = memberRepository;
        this.invitationRepository = invitationRepository;
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
    }

    /** Convite sem resposta por mais que isso expira. */
    public static final int INVITE_TTL_DAYS = 30;

    private ApplicationEventPublisher events;

    @Autowired(required = false)
    public void setEvents(ApplicationEventPublisher events) {
        this.events = events;
    }

    private void publish(WorkEvent.Type type, Project project, User actor, User target) {
        if (events != null) {
            events.publishEvent(WorkEvent.of(type, project, null, actor, target, null));
        }
    }

    static boolean isExpired(ProjectInvitation invitation) {
        return invitation.getStatus() == InvitationStatus.PENDING && invitation.getCreatedAt() != null
                && invitation.getCreatedAt().isBefore(LocalDateTime.now().minusDays(INVITE_TTL_DAYS));
    }

    /** Marca como expirados os convites vencidos e devolve só os que continuam pendentes. */
    private List<ProjectInvitation> stillPending(List<ProjectInvitation> invitations) {
        return invitations.stream().filter(invitation -> {
            if (isExpired(invitation)) {
                invitation.setStatus(InvitationStatus.EXPIRED);
                invitationRepository.save(invitation);
                return false;
            }
            return true;
        }).toList();
    }

    /** Membros do projeto (sem o dono, que vem no próprio projeto). Qualquer participante pode ver. */
    @Transactional(readOnly = true)
    public List<ProjectMember> listMembers(Long projectId, User user) {
        Project project = access.requireParticipant(projectId, user);
        return memberRepository.findByProjectOrderByJoinedAtAsc(project);
    }

    @Transactional
    public ProjectInvitation invite(Long projectId, User owner, String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o e-mail de quem você quer convidar.");
        }
        Project project = access.requireOwner(projectId, owner);
        if (project.getType() == ProjectType.PERSONAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Projetos pessoais não aceitam membros. Use um projeto cooperativo ou corporativo.");
        }
        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Projeto encerrado. Retome o projeto para convidar.");
        }

        User invited = userRepository.findByEmail(email.trim().toLowerCase())
                .or(() -> userRepository.findByEmail(email.trim()))
                .or(() -> {
                    List<User> matches = userRepository.findAllByEmailIgnoreCase(email.trim());
                    return matches.size() == 1 ? Optional.of(matches.get(0)) : Optional.empty();
                })
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Nenhuma conta encontrada com esse e-mail."));

        if (ProjectAccessService.sameUser(invited, owner)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Você já é o dono deste projeto.");
        }
        if (memberRepository.existsByProjectAndUser(project, invited)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Essa pessoa já participa do projeto.");
        }
        boolean pending = stillPending(invitationRepository
                .findByProjectAndStatusOrderByCreatedAtDesc(project, InvitationStatus.PENDING)).stream()
                .anyMatch(candidate -> ProjectAccessService.sameUser(candidate.getInvitedUser(), invited));
        if (pending) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um convite pendente para essa pessoa.");
        }

        ProjectInvitation invitation = new ProjectInvitation();
        invitation.setProject(project);
        invitation.setInvitedUser(invited);
        invitation.setInvitedBy(owner);
        invitation.setStatus(InvitationStatus.PENDING);
        ProjectInvitation saved = invitationRepository.save(invitation);
        publish(WorkEvent.Type.INVITE_SENT, project, owner, invited);
        return saved;
    }

    /** O dono cancela um convite ainda sem resposta. */
    @Transactional
    public void cancelInvitation(Long projectId, Long invitationId, User owner) {
        Project project = access.requireOwner(projectId, owner);
        ProjectInvitation invitation = invitationRepository.findById(invitationId)
                .filter(candidate -> candidate.getProject().getId().equals(project.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Convite não encontrado."));
        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esse convite já foi respondido.");
        }
        invitation.setStatus(InvitationStatus.CANCELLED);
        invitation.setRespondedAt(LocalDateTime.now());
        invitationRepository.save(invitation);
        publish(WorkEvent.Type.INVITE_CANCELLED, project, owner, invitation.getInvitedUser());
    }

    /** Convites pendentes de um projeto (só o dono vê). */
    @Transactional(readOnly = true)
    public List<ProjectInvitation> pendingForProject(Long projectId, User owner) {
        Project project = access.requireOwner(projectId, owner);
        return stillPending(invitationRepository.findByProjectAndStatusOrderByCreatedAtDesc(project, InvitationStatus.PENDING));
    }

    /** Convites pendentes recebidos pelo usuário. */
    @Transactional(readOnly = true)
    public List<ProjectInvitation> myPendingInvitations(User user) {
        return stillPending(invitationRepository.findByInvitedUserAndStatusOrderByCreatedAtDesc(user, InvitationStatus.PENDING));
    }

    @Transactional
    public ProjectInvitation accept(Long invitationId, User user) {
        ProjectInvitation invitation = findPending(invitationId, user);
        Project project = invitation.getProject();
        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esse projeto foi encerrado pelo dono.");
        }
        if (!memberRepository.existsByProjectAndUser(project, user)) {
            memberRepository.save(new ProjectMember(project, user));
        }
        invitation.setStatus(InvitationStatus.ACCEPTED);
        invitation.setRespondedAt(LocalDateTime.now());
        ProjectInvitation saved = invitationRepository.save(invitation);
        publish(WorkEvent.Type.MEMBER_JOINED, project, user, null);
        return saved;
    }

    @Transactional
    public ProjectInvitation decline(Long invitationId, User user) {
        ProjectInvitation invitation = findPending(invitationId, user);
        invitation.setStatus(InvitationStatus.DECLINED);
        invitation.setRespondedAt(LocalDateTime.now());
        return invitationRepository.save(invitation);
    }

    /** O membro sai do projeto. O dono não pode sair (ele encerra ou apaga). */
    @Transactional
    public void leave(Long projectId, User user) {
        Project project = access.requireParticipant(projectId, user);
        if (ProjectAccessService.isOwner(project, user)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "O dono não pode sair do próprio projeto. Encerre ou apague o projeto.");
        }
        memberRepository.findByProjectAndUser(project, user).ifPresent(memberRepository::delete);
        taskRepository.unassignAllInProject(project, user);
        publish(WorkEvent.Type.MEMBER_LEFT, project, user, null);
    }

    /** O dono remove um membro do projeto. */
    @Transactional
    public void removeMember(Long projectId, Long memberUserId, User owner) {
        Project project = access.requireOwner(projectId, owner);
        ProjectMember member = memberRepository.findByProjectOrderByJoinedAtAsc(project).stream()
                .filter(candidate -> candidate.getUser().getId() != null
                        && candidate.getUser().getId().equals(memberUserId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Essa pessoa não é membro do projeto."));
        memberRepository.delete(member);
        taskRepository.unassignAllInProject(project, member.getUser());
        publish(WorkEvent.Type.MEMBER_REMOVED, project, owner, member.getUser());
    }

    private ProjectInvitation findPending(Long invitationId, User user) {
        ProjectInvitation invitation = invitationRepository.findByIdAndInvitedUser(invitationId, user)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Convite não encontrado."));
        if (isExpired(invitation)) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            throw new ResponseStatusException(HttpStatus.GONE, "Esse convite expirou. Peça um novo ao dono do projeto.");
        }
        if (invitation.getStatus() == InvitationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.GONE, "O dono do projeto cancelou esse convite.");
        }
        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esse convite já foi respondido.");
        }
        return invitation;
    }
}
