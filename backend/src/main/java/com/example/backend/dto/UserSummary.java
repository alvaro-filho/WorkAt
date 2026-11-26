package com.example.backend.dto;

import com.example.backend.models.Role;
import com.example.backend.models.User;

/** Dados públicos mínimos de um usuário, para listas de membros e convites. */
public record UserSummary(Long id, String fullName, String username, Role role, String avatarUrl) {
    public static UserSummary from(User user) {
        if (user == null) {
            return null;
        }
        return new UserSummary(user.getId(), user.getFullName(), user.getUsername(), user.getRole(), user.avatarUrl());
    }
}
