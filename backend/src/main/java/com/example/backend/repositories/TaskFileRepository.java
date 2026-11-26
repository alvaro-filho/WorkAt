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

    /** Versões do mesmo arquivo na tarefa ("heroina.png" v1, v2...). */
    long countByTaskAndOriginalNameIgnoreCase(Task task, String originalName);

    /** Espaço usado pela pessoa: arquivos de tarefa enviados por ela. */
    @org.springframework.data.jpa.repository.Query(
            "select coalesce(sum(f.sizeBytes), 0) from TaskFile f where f.uploadedBy = :user")
    long totalBytesUploadedBy(@org.springframework.data.repository.query.Param("user") com.example.backend.models.User user);

    /** Espaço usado pela pessoa: imagens próprias dos posts dela (post avulso ou cópia preservada). */
    @org.springframework.data.jpa.repository.Query(
            "select coalesce(sum(i.sizeBytes), 0) from PostImage i where i.storedName is not null and i.post.author = :user")
    long totalPostBytesOf(@org.springframework.data.repository.query.Param("user") com.example.backend.models.User user);

    List<TaskFile> findByUploadedBy(com.example.backend.models.User user);
}
