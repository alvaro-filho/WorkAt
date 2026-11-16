package com.example.backend.repositories;

import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByProjectOrderByCreatedAtAsc(Project project);

    Optional<Task> findByIdAndProject_CreatedByUser(Long id, User createdByUser);

    void deleteByProject(Project project);
}
