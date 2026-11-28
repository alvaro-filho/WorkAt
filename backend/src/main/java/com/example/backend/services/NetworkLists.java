package com.example.backend.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Listas públicas guardadas no próprio backend (resources/security, fontes em FONTES.txt): faixas de IP de VPN,
 * datacenter e saídas do Tor, e domínios de e-mail descartável. A consulta é local: nenhum IP sai do servidor.
 * IPv6 não é conferido (passa).
 */
@Component
public class NetworkLists {

    private static final Logger log = LoggerFactory.getLogger(NetworkLists.class);

    /** Faixas [início, fim] ordenadas e unidas, em números de 32 bits. */
    private final long[] starts;
    private final long[] ends;
    private final Set<String> disposable;

    public NetworkLists() {
        this(read("security/vpn-ipv4.txt"), read("security/disposable-domains.txt"));
    }

    NetworkLists(List<String> cidrs, List<String> domains) {
        List<long[]> ranges = new ArrayList<>();
        for (String line : cidrs) {
            long[] range = parseCidr(line);
            if (range != null) {
                ranges.add(range);
            }
        }
        ranges.sort((a, b) -> Long.compare(a[0], b[0]));
        List<long[]> merged = new ArrayList<>();
        for (long[] range : ranges) {
            if (!merged.isEmpty() && range[0] <= merged.get(merged.size() - 1)[1] + 1) {
                long[] last = merged.get(merged.size() - 1);
                last[1] = Math.max(last[1], range[1]);
            } else {
                merged.add(range.clone());
            }
        }
        this.starts = merged.stream().mapToLong(range -> range[0]).toArray();
        this.ends = merged.stream().mapToLong(range -> range[1]).toArray();
        this.disposable = new HashSet<>();
        for (String domain : domains) {
            String clean = domain.trim().toLowerCase(Locale.ROOT);
            if (!clean.isEmpty() && !clean.startsWith("#")) {
                disposable.add(clean);
            }
        }
        log.info("Listas de segurança: {} faixas de VPN/datacenter, {} domínios de e-mail descartável",
                starts.length, disposable.size());
    }

    /** IPv4 dentro de uma faixa de VPN, datacenter ou Tor. */
    public boolean isVpn(String ip) {
        long value = parseIp(ip);
        if (value < 0) {
            return false;
        }
        int index = Arrays.binarySearch(starts, value);
        if (index >= 0) {
            return true;
        }
        int before = -index - 2;
        return before >= 0 && value <= ends[before];
    }

    /** E-mail de serviço descartável (o domínio ou um domínio pai está na lista). */
    public boolean isDisposable(String email) {
        if (email == null || !email.contains("@")) {
            return false;
        }
        String domain = email.substring(email.lastIndexOf('@') + 1).trim().toLowerCase(Locale.ROOT);
        while (!domain.isEmpty()) {
            if (disposable.contains(domain)) {
                return true;
            }
            int dot = domain.indexOf('.');
            if (dot < 0) {
                break;
            }
            domain = domain.substring(dot + 1);
        }
        return false;
    }

    static long parseIp(String ip) {
        if (ip == null) {
            return -1;
        }
        String[] parts = ip.trim().split("\\.");
        if (parts.length != 4) {
            return -1;
        }
        long value = 0;
        for (String part : parts) {
            try {
                int octet = Integer.parseInt(part);
                if (octet < 0 || octet > 255) {
                    return -1;
                }
                value = (value << 8) | octet;
            } catch (NumberFormatException e) {
                return -1;
            }
        }
        return value;
    }

    static long[] parseCidr(String line) {
        String text = line == null ? "" : line.trim();
        if (text.isEmpty() || text.startsWith("#")) {
            return null;
        }
        String[] parts = text.split("/");
        long base = parseIp(parts[0]);
        if (base < 0) {
            return null;
        }
        int bits = parts.length > 1 ? Integer.parseInt(parts[1].trim()) : 32;
        if (bits < 0 || bits > 32) {
            return null;
        }
        long size = 1L << (32 - bits);
        long start = base & ~(size - 1) & 0xFFFFFFFFL;
        return new long[]{start, start + size - 1};
    }

    private static List<String> read(String resource) {
        List<String> lines = new ArrayList<>();
        try (InputStream input = NetworkLists.class.getClassLoader().getResourceAsStream(resource)) {
            if (input == null) {
                log.warn("Lista {} não encontrada: a trava correspondente fica desligada.", resource);
                return lines;
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    lines.add(line);
                }
            }
        } catch (IOException e) {
            log.warn("Não deu para ler {}: {}", resource, e.getMessage());
        }
        return lines;
    }
}
