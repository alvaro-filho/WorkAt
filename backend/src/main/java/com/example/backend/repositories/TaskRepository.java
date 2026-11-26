package com.example.backend.repositories;

import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByProjectOrderByCreatedAtAsc(Project project);


    void deleteByProject(Project project);

    /** Quem sai do projeto (ou é removido) deixa de ser responsável pelas tarefas dele. */
    @Modifying
    @Query("update Task t set t.assignee = null where t.project = :project and t.assignee = :user")
    int unassignAllInProject(@Param("project") Project project, @Param("user") User user);
}
