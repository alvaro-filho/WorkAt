package com.example.backend.repositories;

import com.example.backend.models.ModerationEvidence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ModerationEvidenceRepository extends JpaRepository<ModerationEvidence, Long> {

    List<ModerationEvidence> findByUserIdOrderByIdAsc(Long userId);
}
