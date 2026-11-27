package com.example.backend.repositories;

import com.example.backend.models.JobInterest;
import com.example.backend.models.JobInterestMessage;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobInterestMessageRepository extends JpaRepository<JobInterestMessage, Long> {

    @EntityGraph(attributePaths = {"author"})
    List<JobInterestMessage> findByInterestOrderByIdAsc(JobInterest interest);

    long countByInterest(JobInterest interest);
}
