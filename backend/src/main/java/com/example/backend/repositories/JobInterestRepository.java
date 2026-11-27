package com.example.backend.repositories;

import com.example.backend.models.JobCall;
import com.example.backend.models.JobInterest;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface JobInterestRepository extends JpaRepository<JobInterest, Long> {

    Optional<JobInterest> findByCallAndArtist(JobCall call, User artist);

    @EntityGraph(attributePaths = {"artist"})
    List<JobInterest> findByCallOrderByIdAsc(JobCall call);

    long countByCall(JobCall call);

    @EntityGraph(attributePaths = {"call", "call.author"})
    List<JobInterest> findByArtistOrderByIdDesc(User artist);
}
