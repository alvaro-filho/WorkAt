package com.example.backend.repositories;

import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.TaskFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskFileRepository extends JpaRepository<TaskFile, Long> {

    List<TaskFile> findByTaskOrderByVersionDesc(Task task);

    List<TaskFile> findByTask_Project(Project project);

    long countByTask(Task task);
}
