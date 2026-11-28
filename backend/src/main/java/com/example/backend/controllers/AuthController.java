package com.example.backend.controllers;

import com.example.backend.models.User;
import com.example.backend.models.Role;
import com.example.backend.dto.UserDto;
import com.example.backend.services.UserService;
import com.example.backend.dto.LoginRequest;
import com.example.backend.dto.AuthUserResponse;
import com.example.backend.services.JwtService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.Valid;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService userService;
    private final JwtService jwtService;

    /** Opcional: marca no login quem é administrador (mostra o link do painel). */
    private com.example.backend.services.AdminAccess adminAccess;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setAdminAccess(com.example.backend.services.AdminAccess adminAccess) {
        this.adminAccess = adminAccess;
    }


    /** Opcional (testes antigos constroem sem ele): travas de VPN, banimento e registro de acesso. */
    private com.example.backend.services.SecurityGate securityGate;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setSecurityGate(com.example.backend.services.SecurityGate securityGate) {
        this.securityGate = securityGate;
    }

    public AuthController(UserService userService, JwtService jwtService) {
        this.userService = userService;
        this.jwtService = jwtService;
    }

    /**
     * Endpoint de Registro de Usuário (RF001).
     * Exemplo de uso: POST /api/v1/auth/register
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody UserDto registrationData) {
        try {
            if (securityGate != null) {
                securityGate.checkSignup(registrationData.getEmail());
            }
            User newUser = userService.registerUser(
                    registrationData.getFullName(),
                    registrationData.getUsername(),
                    registrationData.getEmail(),
                    registrationData.getPassword(),
                    parseRegistrationRole(registrationData.getRole())
            );
            if (securityGate != null) {
                securityGate.record(com.example.backend.models.SecurityEvent.Type.SIGNUP, newUser, null);
            }
                return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "message", "Cadastro realizado com sucesso",
                    "token", jwtService.generateToken(newUser),
                    "user", AuthUserResponse.from(newUser, adminAccess != null && adminAccess.isAdmin(newUser))
                ));
        } catch (ResponseStatusException e) {
            // E-mail ou username já usados: 409, com a mensagem pronta para a tela.
            return new ResponseEntity<>(e.getReason(), e.getStatusCode());
        } catch (RuntimeException e) {
            return new ResponseEntity<>(e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    private Role parseRegistrationRole(String role) {
        if (role == null || role.isBlank()) {
            throw new IllegalArgumentException("O perfil é obrigatório.");
        }

        return switch (role.trim().toUpperCase()) {
            case "ARTIST" -> Role.ARTIST;
            case "COMPANY" -> Role.COMPANY;
            default -> throw new IllegalArgumentException("Perfil inválido.");
        };
    }

    /**
     * Endpoint de Login de Usuário (RF001).
     * Exemplo de uso: POST /api/v1/auth/login
     */
    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody LoginRequest loginRequest) {
        try {
            if (securityGate != null) {
                securityGate.checkLogin(loginRequest.getEmail());
            }
            // Ajustado para enviar getEmail() em vez de getUsername()
            User authenticatedUser = userService.authenticateUser(
                    loginRequest.getEmail(),
                    loginRequest.getPassword()
            );
            if (securityGate != null) {
                securityGate.record(com.example.backend.models.SecurityEvent.Type.LOGIN_OK, authenticatedUser, null);
            }
            
                return ResponseEntity.ok(Map.of(
                    "message", "Login realizado com sucesso",
                    "token", jwtService.generateToken(authenticatedUser),
                    "user", AuthUserResponse.from(authenticatedUser, adminAccess != null && adminAccess.isAdmin(authenticatedUser))
                ));

        } catch (ResponseStatusException e) {
            // VPN ou acesso banido: 403 com a mensagem pronta para a tela.
            return new ResponseEntity<>(e.getReason(), e.getStatusCode());
        } catch (RuntimeException e) {
            if (securityGate != null) {
                securityGate.record(com.example.backend.models.SecurityEvent.Type.LOGIN_FAIL, null,
                        loginRequest.getEmail(), securityGate.info(), e.getMessage());
            }
            return new ResponseEntity<>(e.getMessage(), HttpStatus.UNAUTHORIZED);
        }
    }
}