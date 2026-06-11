package com.glassstudio.repository;

import com.glassstudio.entity.CostRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CostRecordRepository extends JpaRepository<CostRecord, Long> {

    Optional<CostRecord> findByScheduleId(Long scheduleId);

    boolean existsByScheduleId(Long scheduleId);
}
