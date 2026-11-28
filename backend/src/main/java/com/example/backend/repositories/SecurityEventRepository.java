package com.example.backend.repositories;

import com.example.backend.models.SecurityEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface SecurityEventRepository extends JpaRepository<SecurityEvent, Long> {

    List<SecurityEvent> findByUserIdOrderByIdDesc(Long userId, Pageable page);

    List<SecurityEvent> findByUserIdOrderByIdAsc(Long userId);

    long countByTypeAndIpAndCreatedAtAfter(SecurityEvent.Type type, String ip, LocalDateTime after);

    @Query("select distinct e.ip from SecurityEvent e where e.userId = :userId and e.ip is not null and e.createdAt > :after")
    List<String> ipsOf(@Param("userId") Long userId, @Param("after") LocalDateTime after);

    @Query("select distinct e.deviceId from SecurityEvent e where e.userId = :userId and e.deviceId is not null")
    List<String> devicesOf(@Param("userId") Long userId);

    /** Contas que usaram os mesmos IPs ou aparelhos (contas ligadas). */
    @Query("select distinct e.userId from SecurityEvent e where e.userId is not null and e.userId <> :userId"
            + " and (e.ip in :ips or e.deviceId in :devices)")
    List<Long> relatedUserIds(@Param("userId") Long userId, @Param("ips") Collection<String> ips,
                              @Param("devices") Collection<String> devices);
}
