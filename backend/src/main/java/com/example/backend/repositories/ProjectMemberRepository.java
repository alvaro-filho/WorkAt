package com.example.backend.repositories;

import com.example.backend.models.Project;
import com.example.backend.models.ProjectMember;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {

    boolean existsByProjectAndUser(Project project, User user);

    Optional<ProjectMember> findByProjectAndUser(Project project, User user);

    List<ProjectMember> findByProjectOrderByJoinedAtAsc(Project project);

    List<ProjectMember> findByUser(User user);

    void deleteByProject(Project project);
}
