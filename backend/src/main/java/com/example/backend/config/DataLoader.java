package com.example.backend.config;

import com.example.backend.models.Role;
import com.example.backend.services.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("dev")
@ConditionalOnProperty(prefix = "app.seed", name = "enabled", havingValue = "true")
public class DataLoader implements CommandLineRunner {

    private final UserService userService;
    private final String seedPassword;

    public DataLoader(
            UserService userService,
            @Value("${app.seed.password:}") String seedPassword
    ) {
        this.userService = userService;
        this.seedPassword = seedPassword;
    }

    @Override
    public void run(String... args) throws Exception {
        if (seedPassword == null || seedPassword.isBlank()) {
            throw new IllegalStateException("ARTHUB_DEV_SEED_PASSWORD é obrigatório quando o seed está habilitado.");
        }

        String adminEmail = "admin@atelie.com";
        String adminUsername = "admin";

        // Verifica se o usuário já existe para evitar exceções
        try {
            // Tenta registrar o usuário admin. A lógica de 'findByEmail' no UserService deve tratar duplicatas.
            userService.registerUser("Administrador do Ateliê", adminUsername, adminEmail, seedPassword, Role.ARTIST);
            System.out.println("Seed de desenvolvimento carregado.");
        } catch (RuntimeException e) {
            // Captura o erro de 'email já em uso' e ignora, pois é esperado se já foi rodado.
            if (e.getMessage().contains("Email já está em uso") || e.getMessage().contains("Username já está em uso")) {
                System.out.println("ℹ️ USUÁRIO ADMINISTRADOR JÁ EXISTE. Pulando carga inicial de dados.");
            } else {
                // Propaga outros erros de inicialização
                throw e;
            }
        }
    }
}
