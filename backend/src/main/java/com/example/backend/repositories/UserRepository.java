package com.example.backend.repositories;

import com.example.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Método para encontrar um usuário pelo nome de usuário.
     * JPA irá gerar a implementação do findByUsername.
     */
    Optional<User> findByUsername(String username);

    Optional<User> findByUsernameIgnoreCase(String username);

    /**
     * Método para encontrar um usuário pelo e-mail.
     * JPA irá gerar a implementação do findByEmail.
     */
    Optional<User> findByEmail(String email);

    /** Busca sem diferenciar maiúsculas (contas antigas podem ter sido salvas com letras maiúsculas). */
    List<User> findAllByEmailIgnoreCase(String email);

    /** Conta pelo e-mail digitado, aceitando qualquer combinação de maiúsculas e minúsculas. */
    default Optional<User> findByEmailAnyCase(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        String trimmed = email.trim();
        Optional<User> exact = findByEmail(trimmed);
        if (exact != null && exact.isPresent()) {
            return exact;
        }
        List<User> matches = findAllByEmailIgnoreCase(trimmed);
        return matches != null && matches.size() == 1 ? Optional.of(matches.get(0)) : Optional.empty();
    }
}