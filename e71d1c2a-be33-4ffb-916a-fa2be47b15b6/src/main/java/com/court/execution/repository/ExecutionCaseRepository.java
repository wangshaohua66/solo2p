package com.court.execution.repository;

import com.court.execution.entity.CaseStatus;
import com.court.execution.entity.ExecutionCase;
import com.court.execution.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ExecutionCaseRepository extends JpaRepository<ExecutionCase, Long> {

    ExecutionCase findByCaseNumber(String caseNumber);

    boolean existsByCaseNumber(String caseNumber);

    Page<ExecutionCase> findByStatus(CaseStatus status, Pageable pageable);

    Page<ExecutionCase> findByJudge(User judge, Pageable pageable);

    @Query("SELECT c FROM ExecutionCase c WHERE " +
           "(:caseNumber IS NULL OR c.caseNumber LIKE %:caseNumber%) AND " +
           "(:debtorName IS NULL OR c.debtorName LIKE %:debtorName%) AND " +
           "(:judgeId IS NULL OR c.judge.id = :judgeId) AND " +
           "(:status IS NULL OR c.status = :status)")
    Page<ExecutionCase> findByConditions(
            @Param("caseNumber") String caseNumber,
            @Param("debtorName") String debtorName,
            @Param("judgeId") Long judgeId,
            @Param("status") CaseStatus status,
            Pageable pageable);

    long countByStatus(CaseStatus status);

    long countByJudgeAndStatus(User judge, CaseStatus status);

    @Query("SELECT COUNT(c) FROM ExecutionCase c WHERE c.filingDate BETWEEN :startDate AND :endDate")
    long countByFilingDateBetween(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    @Query("SELECT c.judge.id, c.judge.realName, COUNT(c) FROM ExecutionCase c GROUP BY c.judge.id, c.judge.realName")
    List<Object[]> countByJudge();

    @Query("SELECT c.judge.id, c.judge.realName, COUNT(c) FROM ExecutionCase c " +
           "WHERE c.status = 'CLOSED' GROUP BY c.judge.id, c.judge.realName")
    List<Object[]> countClosedByJudge();
}
