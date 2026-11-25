package com.example.backend.dto;

import com.example.backend.models.ProjectMember;
import com.example.backend.models.ProjectRole;

import java.time.LocalDateTime;

public record ProjectMemberResponse(UserSummary user, ProjectRole role, LocalDateTime joinedAt) {
    public static ProjectMemberResponse from(ProjectMember member) {
        return new ProjectMemberResponse(UserSummary.from(member.getUser()), ProjectRole.MEMBER, member.getJoinedAt());
    }
}
