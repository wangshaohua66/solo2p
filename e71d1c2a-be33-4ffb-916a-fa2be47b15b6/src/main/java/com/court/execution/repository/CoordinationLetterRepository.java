package com.court.execution.repository;

import com.court.execution.entity.CoordinationLetter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CoordinationLetterRepository extends JpaRepository<CoordinationLetter, Long> {

    CoordinationLetter findByLetterNumber(String letterNumber);

    boolean existsByLetterNumber(String letterNumber);

    List<CoordinationLetter> findByExecutionCaseIdOrderByCreateTimeDesc(Long caseId);

    Page<CoordinationLetter> findByExecutionCaseId(Long caseId, Pageable pageable);

    List<CoordinationLetter> findByUnitIdOrderByCreateTimeDesc(Long unitId);

    @Query("SELECT l FROM CoordinationLetter l WHERE l.status = 'SENT' AND l.feedbackTime IS NULL " +
           "AND l.sendTime < :timeoutDate AND l.reminderSent = false ORDER BY l.sendTime ASC")
    List<CoordinationLetter> findLettersNeedingReminder(@Param("timeoutDate") LocalDateTime timeoutDate);

    @Query("SELECT l FROM CoordinationLetter l WHERE l.status = :status")
    Page<CoordinationLetter> findByStatus(@Param("status") String status, Pageable pageable);

    long countByStatus(String status);

    @Query("SELECT COUNT(l) FROM CoordinationLetter l WHERE l.createTime BETWEEN :startDate AND :endDate")
    long countByCreateTimeBetween(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
}
