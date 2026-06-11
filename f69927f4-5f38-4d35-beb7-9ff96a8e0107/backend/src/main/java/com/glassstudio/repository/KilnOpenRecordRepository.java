package com.glassstudio.repository;

import com.glassstudio.entity.KilnOpenRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KilnOpenRecordRepository extends JpaRepository<KilnOpenRecord, Long> {

    List<KilnOpenRecord> findByKilnId(Long kilnId);

    List<KilnOpenRecord> findByScheduleId(Long scheduleId);

    List<KilnOpenRecord> findByOperatorId(Long operatorId);

    List<KilnOpenRecord> findByIsViolationTrue();
}
