package com.example.backend.services;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Leitura do IP real no caminho navegador → Vercel → Cloudflare → Render (valores do whoami de produção). */
class ClientContextTest {

    private final NetworkLists lists = new NetworkLists(List.of("15.228.0.0/16"), List.of());

    @Test
    void viaVercelUsesTheIpVercelReports() {
        assertEquals("187.113.29.129", ClientContext.clientIp("15.228.189.151", "187.113.29.129,15.228.189.151",
                "187.113.29.129", "104.23.209.107", lists));
    }

    @Test
    void directCallToRenderCannotFakeTheVercelHeader() {
        // Quem chama o Render direto de um IP residencial: a Cloudflare põe o IP verdadeiro e o cabeçalho falso é ignorado.
        assertEquals("200.10.20.30", ClientContext.clientIp("200.10.20.30", "1.1.1.1, 200.10.20.30",
                "1.1.1.1", "104.23.209.107", lists));
    }

    @Test
    void withoutCloudflareUsesTheRightmostPublicForwardedIp() {
        assertEquals("203.0.113.50", ClientContext.clientIp(null, "8.8.8.8, 203.0.113.50, 10.0.0.2", null,
                "127.0.0.1", lists));
        assertEquals("127.0.0.1", ClientContext.clientIp(null, null, null, "127.0.0.1", lists));
    }
}
