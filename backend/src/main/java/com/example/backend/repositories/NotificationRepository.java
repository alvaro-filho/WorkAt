package com.example.backend.repositories;

import com.example.backend.models.Notification;
import com.example.backend.models.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserOrderByIdDesc(User user, Pageable page);

    long countByUserAndReadFalse(User user);

    boolean existsByUserAndRefKey(User user, String refKey);

    Optional<Notification> findByIdAndUser(Long id, User user);

    @Modifying
    @Query("update Notification n set n.read = true where n.user = :user and n.read = false")
    int markAllRead(@Param("user") User user);

    @Modifying
    @Query("delete from Notification n where n.user = :user")
    int deleteAllOf(@Param("user") User user);
}
