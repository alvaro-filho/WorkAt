package com.example.backend.services;

import com.example.backend.models.Notification;
import com.example.backend.models.User;
import com.example.backend.repositories.NotificationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** Avisos do usuário: os 50 mais recentes, contagem de não lidos e marcar como lido. */
@Service
public class NotificationService {

    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<Notification> latest(User user) {
        return repository.findByUserOrderByIdDesc(user, PageRequest.of(0, 50));
    }

    @Transactional(readOnly = true)
    public long unread(User user) {
        return repository.countByUserAndReadFalse(user);
    }

    @Transactional
    public Notification markRead(Long id, User user) {
        Notification n = repository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Aviso não encontrado."));
        n.setRead(true);
        return repository.save(n);
    }

    @Transactional
    public void markAllRead(User user) {
        repository.markAllRead(user);
    }
}
