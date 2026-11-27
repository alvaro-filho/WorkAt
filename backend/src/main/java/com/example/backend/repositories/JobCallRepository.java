package com.example.backend.repositories;

import com.example.backend.models.JobCall;
import com.example.backend.models.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface JobCallRepository extends JpaRepository<JobCall, Long> {

    /** Chamadas abertas de verdade (status OPEN e prazo não vencido), mais novas primeiro. */
    @EntityGraph(attributePaths = {"author"})
    @Query("select c from JobCall c where c.status = :status and c.closesOn >= :today order by c.id desc")
    List<JobCall> findByStatusOpenSince(@Param("status") JobCall.Status status, @Param("today") LocalDate today);

    default List<JobCall> findOpen(LocalDate today) {
        return findByStatusOpenSince(JobCall.Status.OPEN, today);
    }

    @EntityGraph(attributePaths = {"author"})
    List<JobCall> findByAuthorOrderByIdDesc(User author);

    @Query("select count(c) from JobCall c where c.author = :author and c.status = :status and c.closesOn >= :today")
    long countByStatusSince(@Param("author") User author, @Param("status") JobCall.Status status,
                            @Param("today") LocalDate today);

    default long countOpenBy(User author, LocalDate today) {
        return countByStatusSince(author, JobCall.Status.OPEN, today);
    }
}
