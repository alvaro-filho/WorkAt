package com.example.backend.repositories;

import com.example.backend.models.AdminAction;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AdminActionRepository extends JpaRepository<AdminAction, Long> {

    List<AdminAction> findAllByOrderByIdDesc(Pageable page);

    List<AdminAction> findByTargetTypeAndTargetIdOrderByIdDesc(String targetType, Long targetId);
}
