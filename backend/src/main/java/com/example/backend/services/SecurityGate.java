package com.example.backend.services;

import com.example.backend.models.SecurityBan;
import com.example.backend.models.SecurityEvent;
import com.example.backend.models.User;
import com.example.backend.repositories.SecurityBanRepository;
import com.example.backend.repositories.SecurityEventRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Locale;

/**
 * Porteiro do cadastro, do login e das publicações:
 * - VPN, proxy, datacenter ou Tor: barrado com aviso (ver artes continua livre).
 * - IP, aparelho ou e-mail banidos: barrado.
 * - No máximo N contas novas por IP em 24 horas; e-mail descartável não cadastra.
 * Cada tentativa, aceita ou barrada, vai para o registro de acesso (security_event) com IP, navegador e aparelho.
 */
@Service
public class SecurityGate {

    public static final String VPN_MESSAGE = "Detectamos uma VPN ou proxy na sua conexão. Por segurança, a WorkAt "
            + "só permite criar conta, entrar e publicar sem VPN. Desative a VPN e tente de novo.";
    static final String BANNED_MESSAGE = "Acesso bloqueado pela moderação da WorkAt.";

    private final ClientContext client;
    private final NetworkLists lists;
    private final SecurityEventRepository events;
    private final SecurityBanRepository bans;
    private final boolean vpnCheck;
    private final boolean ipChecks;
    private final int signupsPerIpPerDay;
    private AdminAccess adminAccess;

    /**
     * ipChecks (ARTHUB_IP_CHECKS): liga as travas que dependem do IP (VPN, limite por IP, IP banido). Fica
     * desligado até conferir em produção (rota /api/v1/admin/whoami) que o servidor enxerga o IP real de quem
     * usa o site, e não o do proxy da Vercel: com o IP errado, essas travas barrariam todo mundo.
     * Aparelho, e-mail e quarentena valem sempre.
     */
    public SecurityGate(ClientContext client, NetworkLists lists, SecurityEventRepository events,
                        SecurityBanRepository bans,
                        @Value("${app.security.block-vpn:true}") boolean vpnCheck,
                        @Value("${app.security.ip-checks:false}") boolean ipChecks,
                        @Value("${app.security.signups-per-ip-per-day:2}") int signupsPerIpPerDay) {
        this.client = client;
        this.lists = lists;
        this.events = events;
        this.bans = bans;
        this.ipChecks = ipChecks;
        this.vpnCheck = vpnCheck && ipChecks;
        this.signupsPerIpPerDay = signupsPerIpPerDay;
    }

    /** Opcional: o administrador nunca é barrado pela trava de VPN no login (para não se trancar para fora). */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setAdminAccess(AdminAccess adminAccess) {
        this.adminAccess = adminAccess;
    }

    public ClientContext.Info info() {
        return client.current();
    }

    /** Antes de criar a conta. */
    public void checkSignup(String email) {
        ClientContext.Info info = client.current();
        String normalized = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
        if (isBanned(info, normalized)) {
            record(SecurityEvent.Type.BLOCKED_BAN, null, normalized, info, "cadastro");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, BANNED_MESSAGE);
        }
        if (vpnCheck && lists.isVpn(info.ip())) {
            record(SecurityEvent.Type.BLOCKED_VPN, null, normalized, info, "cadastro");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, VPN_MESSAGE);
        }
        if (lists.isDisposable(normalized)) {
            record(SecurityEvent.Type.BLOCKED_EMAIL, null, normalized, info, "e-mail descartável");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Use um e-mail permanente: endereços temporários ou descartáveis não são aceitos.");
        }
        if (ipChecks && info.ip() != null && signupsPerIpPerDay > 0
                && events.countByTypeAndIpAndCreatedAtAfter(SecurityEvent.Type.SIGNUP, info.ip(),
                LocalDateTime.now().minusHours(24)) >= signupsPerIpPerDay) {
            record(SecurityEvent.Type.BLOCKED_LIMIT, null, normalized, info, "limite de contas por IP");
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Muitas contas foram criadas desta conexão hoje. Tente de novo amanhã.");
        }
    }

    /** Antes de conferir a senha (não revela se a conta existe). */
    public void checkLogin(String email) {
        ClientContext.Info info = client.current();
        String normalized = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
        // O administrador nunca é barrado no login (nem por aparelho/IP bloqueado por engano, nem por VPN).
        boolean admin = adminAccess != null && normalized != null && adminAccess.emails().contains(normalized);
        if (!admin && isBanned(info, normalized)) {
            record(SecurityEvent.Type.BLOCKED_BAN, null, normalized, info, "login");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, BANNED_MESSAGE);
        }
        if (vpnCheck && !admin && lists.isVpn(info.ip())) {
            record(SecurityEvent.Type.BLOCKED_VPN, null, normalized, info, "login");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, VPN_MESSAGE);
        }
    }

    /** Antes de publicar, enviar arquivo ou comentar. */
    public void checkPosting(User user, SecurityEvent.Type what) {
        ClientContext.Info info = client.current();
        boolean admin = adminAccess != null && adminAccess.isAdmin(user);
        if (!admin && isBanned(info, user == null ? null : user.getEmail())) {
            record(SecurityEvent.Type.BLOCKED_BAN, user, null, info, what.name());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, BANNED_MESSAGE);
        }
        if (vpnCheck && !admin && lists.isVpn(info.ip())) {
            record(SecurityEvent.Type.BLOCKED_VPN, user, null, info, what.name());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, VPN_MESSAGE);
        }
        record(what, user, null, info, null);
    }

    /**
     * Grava no registro de acesso. É chamado pelos controllers, fora das transações dos serviços, então a linha
     * fica gravada mesmo quando a ação é recusada logo depois.
     */
    public void record(SecurityEvent.Type type, User user, String email, ClientContext.Info info, String detail) {
        SecurityEvent event = new SecurityEvent();
        event.setType(type);
        if (user != null) {
            event.setUserId(user.getId());
            event.setUsername(user.getUsername());
            event.setEmail(user.getEmail());
        } else {
            event.setEmail(email == null ? null : (email.length() > 160 ? email.substring(0, 160) : email));
        }
        ClientContext.Info source = info == null ? ClientContext.Info.NONE : info;
        event.setIp(source.ip());
        event.setUserAgent(source.userAgent());
        event.setDeviceId(source.deviceId());
        event.setForwardedChain(source.forwardedChain());
        event.setDetail(detail);
        events.save(event);
    }

    public void record(SecurityEvent.Type type, User user, String detail) {
        record(type, user, null, client.current(), detail);
    }

    private boolean isBanned(ClientContext.Info info, String email) {
        LocalDateTime now = LocalDateTime.now();
        return (ipChecks && active(SecurityBan.Kind.IP, info.ip(), now))
                || active(SecurityBan.Kind.DEVICE, info.deviceId(), now)
                || active(SecurityBan.Kind.EMAIL, email == null ? null : email.trim().toLowerCase(Locale.ROOT), now);
    }

    private boolean active(SecurityBan.Kind kind, String value, LocalDateTime now) {
        return value != null && bans.findByKindAndValue(kind, value).stream().anyMatch(ban -> ban.isActive(now));
    }
}
