package com.example.backend.services;

import com.example.backend.models.Role; // Importando Role
import com.example.backend.models.User;
import com.example.backend.repositories.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Registra um novo usuário no sistema.
     * @param username Nome de usuário desejado.
     * @param email Email do usuário.
     * @param password Senha em texto simples.
     * @param role Função do usuário.
     * @return O usuário criado.
     * @throws RuntimeException se o username ou email já existirem.
     */
    public User registerUser(String fullName, String username, String email, String password, Role role) {
        // E-mail salvo sempre em minúsculas: o login não pode depender de como a pessoa digitou.
        email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByUsername(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username já está em uso.");
        }
        if (email != null && !userRepository.findAllByEmailIgnoreCase(email).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email já está em uso.");
        }

        // 1. Hash da senha
        String hashedPassword = passwordEncoder.encode(password);

        // 2. Criação da entidade
        User newUser = new User();
        newUser.setFullName(fullName);
        newUser.setUsername(username);
        newUser.setEmail(email);
        newUser.setPasswordHash(hashedPassword);
        newUser.setRole(role);
        newUser.setUserType(role.name());

        // 3. Persistência
        return userRepository.save(newUser);
    }

    /**
     * Autentica um usuário e retorna o objeto User (sem a senha) e o JWT token.
     * @param username Nome de usuário.
     * @param password Senha fornecida.
     * @return O objeto User autenticado.
     * @throws RuntimeException se as credenciais forem inválidas.
     */
    public User authenticateUser(String email, String password) {
    // Mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta.
    User user = userRepository.findByEmailAnyCase(email)
        .orElseThrow(() -> new RuntimeException("E-mail ou senha incorretos."));

    if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
        throw new RuntimeException("E-mail ou senha incorretos.");
    }

    return user;
}
}