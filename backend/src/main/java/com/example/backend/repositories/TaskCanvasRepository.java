package com.example.backend.repositories;

import com.example.backend.models.Task;
import com.example.backend.models.TaskCanvas;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TaskCanvasRepository extends JpaRepository<TaskCanvas, Long> {
    Optional<TaskCanvas> findByTask(Task task);
}
