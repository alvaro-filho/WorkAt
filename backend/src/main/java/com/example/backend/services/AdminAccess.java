package com.example.backend.services;

import com.example.backend.models.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Quem é administrador: só os e-mails da variável ARTHUB_ADMIN_EMAILS (separados por vírgula).
 * Nada no site, no banco ou na API muda essa lista; para ter outro administrador, só mexendo no servidor.
 */
@Component
public class AdminAccess {

    private final Set<String> emails;

    public AdminAccess(@Value("${app.admin.emails:}") String emails) {
        this.emails = Arrays.stream(emails == null ? new String[0] : emails.split(","))
                .map(email -> email.trim().toLowerCase(Locale.ROOT))
                .filter(email -> !email.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    public boolean isAdmin(User user) {
        return user != null && !user.isDeleted() && !user.isBanned() && user.getEmail() != null
                && emails.contains(user.getEmail().trim().toLowerCase(Locale.ROOT));
    }

    /** Os e-mails da lista (para avisar os administradores). */
    public Set<String> emails() {
        return emails;
    }

    public boolean configured() {
        return !emails.isEmpty();
    }
}
