package com.example.backend.repositories;

import com.example.backend.models.Task;
import com.example.backend.models.TaskComment;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {

    List<TaskComment> findByTaskOrderByIdAsc(Task task);

    List<TaskComment> findByAuthorOrderByIdAsc(User author);
}
