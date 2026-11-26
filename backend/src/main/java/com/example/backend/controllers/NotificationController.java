package com.example.backend.controllers;

import com.example.backend.models.Notification;
import com.example.backend.services.CurrentUser;
import com.example.backend.services.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
public class NotificationController {

    private final NotificationService notifications;
    private final CurrentUser currentUser;

    public NotificationController(NotificationService notifications, CurrentUser currentUser) {
        this.notifications = notifications;
        this.currentUser = currentUser;
    }

    public record NotificationResponse(Long id, String type, String message, String link, boolean read,
                                       LocalDateTime createdAt) {
        static NotificationResponse from(Notification n) {
            return new NotificationResponse(n.getId(), n.getType(), n.getMessage(), n.getLink(), n.isRead(),
                    n.getCreatedAt());
        }
    }

    public record NotificationList(long unread, List<NotificationResponse> items) {
    }

    @GetMapping("/api/v1/notifications")
    public NotificationList list(Authentication authentication) {
        var user = currentUser.require(authentication);
        return new NotificationList(notifications.unread(user),
                notifications.latest(user).stream().map(NotificationResponse::from).toList());
    }

    /** Só a contagem, para o menu consultar com frequência sem baixar a lista. */
    @GetMapping("/api/v1/notifications/unread-count")
    public Map<String, Long> unread(Authentication authentication) {
        return Map.of("unread", notifications.unread(currentUser.require(authentication)));
    }

    @PostMapping("/api/v1/notifications/{id}/read")
    public NotificationResponse read(@PathVariable Long id, Authentication authentication) {
        return NotificationResponse.from(notifications.markRead(id, currentUser.require(authentication)));
    }

    @PostMapping("/api/v1/notifications/read-all")
    public ResponseEntity<Void> readAll(Authentication authentication) {
        notifications.markAllRead(currentUser.require(authentication));
        return ResponseEntity.noContent().build();
    }
}
