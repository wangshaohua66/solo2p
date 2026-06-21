package com.court.execution.repository;

import com.court.execution.entity.SeizureRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SeizureRecordRepository extends JpaRepository<SeizureRecord, Long> {

    List<SeizureRecord> findByPropertyIdOrderByCreateTimeDesc(Long propertyId);

    List<SeizureRecord> findByExecutionCaseIdOrderByCreateTimeDesc(Long caseId);

    Page<SeizureRecord> findByExecutionCaseId(Long caseId, Pageable pageable);

    @Query("SELECT s FROM SeizureRecord s WHERE s.expired = false " +
           "AND s.endDate BETWEEN :startDate AND :endDate ORDER BY s.endDate ASC")
    List<SeizureRecord> findSeizuresExpiringBetween(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    @Query("SELECT s FROM SeizureRecord s WHERE s.expired = false AND s.warningSent = false " +
           "AND s.endDate <= :warningDate ORDER BY s.endDate ASC")
    List<SeizureRecord> findSeizuresNeedingWarning(@Param("warningDate") LocalDateTime warningDate);

    long countByExecutionCaseId(Long caseId);

    @Query("SELECT COUNT(s) FROM SeizureRecord s WHERE s.startDate BETWEEN :startDate AND :endDate")
    long countByStartDateBetween(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
}
