package com.example.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class InvitationCreateRequest {
    @NotBlank(message = "Informe o e-mail de quem você quer convidar.")
    @Email(message = "E-mail inválido.")
    private String email;

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}
