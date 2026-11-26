package com.example.backend.repositories;

import com.example.backend.models.Project;
import com.example.backend.models.Task;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByProjectOrderByCreatedAtAsc(Project project);

    /** "Minhas tarefas": abertas, de projetos ativos, atribuídas à pessoa; prazo mais próximo primeiro. */
    @Query("select t from Task t join fetch t.project p where t.assignee = :user "
            + "and p.status = com.example.backend.models.ProjectStatus.ACTIVE "
            + "and t.status <> com.example.backend.models.TaskStatus.DONE "
            + "order by t.deadline asc nulls last, t.id asc")
    List<Task> findOpenAssignedTo(@Param("user") User user);

    /** Tarefas abertas com prazo no dia informado (lembrete da véspera). */
    @Query("select t from Task t join fetch t.project p where t.deadline = :day and t.assignee is not null "
            + "and p.status = com.example.backend.models.ProjectStatus.ACTIVE "
            + "and t.status <> com.example.backend.models.TaskStatus.DONE")
    List<Task> findOpenDueOn(@Param("day") LocalDate day);

    List<Task> findByAssignee(User assignee);


    void deleteByProject(Project project);

    /** Quem sai do projeto (ou é removido) deixa de ser responsável pelas tarefas dele. */
    @Modifying
    @Query("update Task t set t.assignee = null where t.project = :project and t.assignee = :user")
    int unassignAllInProject(@Param("project") Project project, @Param("user") User user);
}
