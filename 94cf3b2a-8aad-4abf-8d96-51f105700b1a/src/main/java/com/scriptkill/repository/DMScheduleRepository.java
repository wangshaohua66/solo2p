package com.scriptkill.repository;

import com.scriptkill.entity.DMSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface DMScheduleRepository extends JpaRepository<DMSchedule, Long> {

    List<DMSchedule> findByDmId(Long dmId);

    List<DMSchedule> findByDmIdAndScheduleDateBetween(Long dmId, LocalDate startDate, LocalDate endDate);

    List<DMSchedule> findByScheduleDate(LocalDate date);

    @Query("SELECT ds FROM DMSchedule ds WHERE ds.dm.id = :dmId AND ds.scheduleDate BETWEEN :startDate AND :endDate AND ds.isPaid = false")
    List<DMSchedule> findUnpaidSchedules(Long dmId, LocalDate startDate, LocalDate endDate);

    @Query("SELECT COALESCE(SUM(ds.totalEarnings), 0) FROM DMSchedule ds WHERE ds.dm.id = :dmId AND ds.scheduleDate BETWEEN :startDate AND :endDate AND ds.isPaid = false")
    Integer calculateTotalUnpaidEarnings(Long dmId, LocalDate startDate, LocalDate endDate);

    List<DMSchedule> findBySessionId(Long sessionId);

    boolean existsByDmIdAndScheduleDate(Long dmId, LocalDate scheduleDate);
}
