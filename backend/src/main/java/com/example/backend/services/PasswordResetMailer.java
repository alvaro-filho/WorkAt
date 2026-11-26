package com.example.backend.services;

import com.example.backend.models.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Entrega do link de nova senha. Ainda não há serviço de e-mail configurado: o link vai para o log do
 * backend (útil em desenvolvimento). Para produção, troque por um envio real (SMTP, Resend, SES...).
 */
@Component
public class PasswordResetMailer {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetMailer.class);

    public void send(User user, String link) {
        log.info("Link de nova senha para {} (sem e-mail configurado, só no log): {}", user.getUsername(), link);
    }
}
