package com.example.backend.services;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * De onde vem a requisição: IP, navegador e o código do aparelho (X-Device-Id, gerado pelo site e guardado no
 * navegador). Atrás do proxy do Render, o IP real vem nos cabeçalhos; a cadeia inteira também é guardada
 * (forwardedChain) para servir de prova.
 */
@Component
public class ClientContext {

    /**
     * Cabeçalho de IP em que dá para confiar (ARTHUB_CLIENT_IP_HEADER, ex.: CF-Connecting-IP), só se o servidor
     * estiver atrás de um proxy que sempre o sobrescreve. Vazio: usa o X-Forwarded-For pelo lado direito.
     */
    private static volatile String trustedHeader = "";

    public ClientContext(@org.springframework.beans.factory.annotation.Value("${app.security.client-ip-header:}") String header) {
        trustedHeader = header == null ? "" : header.trim();
    }

    public record Info(String ip, String userAgent, String deviceId, String forwardedChain) {
        public static final Info NONE = new Info(null, null, null, null);
    }

    public Info current() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
            return Info.NONE;
        }
        return of(attributes.getRequest());
    }

    public static Info of(HttpServletRequest request) {
        if (request == null) {
            return Info.NONE;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        // X-Forwarded-For: cada proxy acrescenta à direita, então o que vem à esquerda pode ser falsificado;
        // vale o IP público mais à direita (o que o proxy do Render viu). Cabeçalhos como CF-Connecting-IP só
        // contam se configurados (o navegador também consegue mandá-los).
        String ip = firstNonBlank(trustedHeader.isEmpty() ? null : request.getHeader(trustedHeader),
                rightmostPublic(forwarded), request.getRemoteAddr());
        return new Info(clean(ip, 64), clean(request.getHeader("User-Agent"), 300),
                validDevice(request.getHeader("X-Device-Id")), clean(forwarded, 300));
    }

    /** Código do aparelho: só letras, números e hífen, até 64 caracteres (o resto é ignorado). */
    static String validDevice(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.matches("[A-Za-z0-9-]{8,64}") ? trimmed : null;
    }

    /** O IP público mais à direita do X-Forwarded-For (ignora os da rede interna dos proxies). */
    static String rightmostPublic(String forwarded) {
        if (forwarded == null || forwarded.isBlank()) {
            return null;
        }
        String[] parts = forwarded.split(",");
        for (int index = parts.length - 1; index >= 0; index--) {
            String candidate = parts[index].trim();
            if (!candidate.isEmpty() && !isPrivate(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    static boolean isPrivate(String ip) {
        long value = NetworkLists.parseIp(ip);
        if (value < 0) {
            return ip.equals("::1") || ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")
                    || ip.toLowerCase().startsWith("fe80");
        }
        long a = value >> 24, b = (value >> 16) & 0xFF;
        return a == 10 || a == 127 || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168)
                || (a == 100 && b >= 64 && b <= 127) || (a == 169 && b == 254) || a == 0;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static String clean(String value, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }
}
