package com.example.backend.dto;

import com.example.backend.models.User;

public record AuthUserResponse(
        Long id,
        String fullName,
        String username,
        String email,
        String role,
        String userType,
        /** Está na lista de administradores (mostra o link do painel). */
        boolean admin
) {
    public static AuthUserResponse from(User user) {
        return from(user, false);
    }

    public static AuthUserResponse from(User user, boolean admin) {
        return new AuthUserResponse(
                user.getId(),
                user.getFullName(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name(),
                user.getUserType(),
                admin
        );
    }
}