package com.court.execution.repository;

import com.court.execution.entity.FundRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface FundRecordRepository extends JpaRepository<FundRecord, Long> {

    List<FundRecord> findByExecutionCaseIdOrderByCreateTimeDesc(Long caseId);

    Page<FundRecord> findByExecutionCaseId(Long caseId, Pageable pageable);

    @Query("SELECT COALESCE(SUM(f.amount), 0) FROM FundRecord f WHERE f.executionCase.id = :caseId")
    BigDecimal sumByCaseId(@Param("caseId") Long caseId);

    @Query("SELECT COALESCE(SUM(f.amount), 0) FROM FundRecord f WHERE f.receivedDate BETWEEN :startDate AND :endDate")
    BigDecimal sumByReceivedDateBetween(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    @Query("SELECT COUNT(f) FROM FundRecord f WHERE f.receivedDate BETWEEN :startDate AND :endDate")
    long countByReceivedDateBetween(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
}
