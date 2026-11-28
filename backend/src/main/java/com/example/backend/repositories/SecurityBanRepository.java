package com.example.backend.repositories;

import com.example.backend.models.SecurityBan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SecurityBanRepository extends JpaRepository<SecurityBan, Long> {

    List<SecurityBan> findByKindAndValue(SecurityBan.Kind kind, String value);

    List<SecurityBan> findBySourceUserIdOrderByIdAsc(Long sourceUserId);
}
