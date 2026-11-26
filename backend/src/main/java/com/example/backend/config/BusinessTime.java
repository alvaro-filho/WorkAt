package com.example.backend.config;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * "Hoje" para as regras de negócio (liberação do NDA), sempre no fuso do Brasil.
 * O servidor do Render roda em UTC: sem isto, um NDA com liberação em 27/11 valeria
 * desde as 21h de 26/11 no horário de Brasília. Dá para trocar o fuso por APP_TIMEZONE.
 */
public final class BusinessTime {

    public static final ZoneId ZONE = resolveZone(System.getenv("APP_TIMEZONE"));

    private BusinessTime() {
    }

    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    static ZoneId resolveZone(String configured) {
        if (configured == null || configured.isBlank()) {
            return ZoneId.of("America/Sao_Paulo");
        }
        return ZoneId.of(configured.trim());
    }
}
