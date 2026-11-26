package com.example.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class InvitationCreateRequest {
    /** E-mail ou @usuário de quem vai ser convidado. */
    @NotBlank(message = "Informe o e-mail ou o @usuário de quem você quer convidar.")
    private String email;

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}
