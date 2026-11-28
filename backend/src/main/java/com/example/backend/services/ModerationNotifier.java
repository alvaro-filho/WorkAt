package com.example.backend.services;

import com.example.backend.models.Notification;
import com.example.backend.models.Post;
import com.example.backend.repositories.NotificationRepository;
import com.example.backend.repositories.UserRepository;
import org.springframework.stereotype.Component;

/** Avisa os administradores (notificação) quando uma conta nova manda publicação para aprovação. */
@Component
public class ModerationNotifier {

    private final AdminAccess adminAccess;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    public ModerationNotifier(AdminAccess adminAccess, UserRepository userRepository,
                              NotificationRepository notificationRepository) {
        this.adminAccess = adminAccess;
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
    }

    public void pendingPost(Post post) {
        String who = post.getAuthor() == null ? "Conta nova" : "@" + post.getAuthor().getUsername();
        for (String email : adminAccess.emails()) {
            userRepository.findByEmailAnyCase(email).filter(adminAccess::isAdmin).ifPresent(admin -> {
                Notification notification = new Notification();
                notification.setUser(admin);
                notification.setType("MODERATION_PENDING");
                notification.setMessage(who + " (conta nova) enviou uma publicação que espera sua aprovação.");
                notification.setLink("/admin?aba=aprovacao");
                notificationRepository.save(notification);
            });
        }
    }
}
