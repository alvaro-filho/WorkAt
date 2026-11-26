package com.example.backend.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Verificação de saúde, pública e sem banco de dados.
 * Usada pelo Render (healthCheckPath) e pelo ping que mantém o backend acordado no plano grátis.
 * Não toca no banco de propósito: assim o Neon pode continuar dormindo quando ninguém usa.
 */
@RestController
public class HealthController {

    @GetMapping("/api/v1/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
