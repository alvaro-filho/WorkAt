package com.example.backend.repositories;

import com.example.backend.models.Project;
import com.example.backend.models.ProjectHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectHistoryRepository extends JpaRepository<ProjectHistory, Long> {

    List<ProjectHistory> findByProjectOrderByIdDesc(Project project, Pageable page);
}
