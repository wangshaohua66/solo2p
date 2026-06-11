package com.glassstudio.repository;

import com.glassstudio.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    List<Schedule> findByKilnIdAndStartTimeBetween(Long kilnId, LocalDateTime start, LocalDateTime end);

    List<Schedule> findByKilnIdAndStatusNot(Long kilnId, String status);

    List<Schedule> findByMemberId(Long memberId);

    List<Schedule> findByStatus(String status);
}
