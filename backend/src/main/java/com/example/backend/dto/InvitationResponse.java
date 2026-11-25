package com.example.backend.dto;

import com.example.backend.models.InvitationStatus;
import com.example.backend.models.ProjectInvitation;
import com.example.backend.models.ProjectType;

import java.time.LocalDateTime;

public record InvitationResponse(
        Long id,
        Long projectId,
        String projectName,
        ProjectType projectType,
        UserSummary invitedUser,
        UserSummary invitedBy,
        InvitationStatus status,
        LocalDateTime createdAt
) {
    public static InvitationResponse from(ProjectInvitation invitation) {
        return new InvitationResponse(
                invitation.getId(),
                invitation.getProject().getId(),
                invitation.getProject().getName(),
                invitation.getProject().getType(),
                UserSummary.from(invitation.getInvitedUser()),
                UserSummary.from(invitation.getInvitedBy()),
                invitation.getStatus(),
                invitation.getCreatedAt()
        );
    }
}
