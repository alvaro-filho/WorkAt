package com.example.backend.repositories;

import com.example.backend.models.InvitationStatus;
import com.example.backend.models.Project;
import com.example.backend.models.ProjectInvitation;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectInvitationRepository extends JpaRepository<ProjectInvitation, Long> {

    boolean existsByProjectAndInvitedUserAndStatus(Project project, User invitedUser, InvitationStatus status);

    List<ProjectInvitation> findByInvitedUserAndStatusOrderByCreatedAtDesc(User invitedUser, InvitationStatus status);

    List<ProjectInvitation> findByProjectAndStatusOrderByCreatedAtDesc(Project project, InvitationStatus status);

    Optional<ProjectInvitation> findByIdAndInvitedUser(Long id, User invitedUser);

    void deleteByProject(Project project);
}
