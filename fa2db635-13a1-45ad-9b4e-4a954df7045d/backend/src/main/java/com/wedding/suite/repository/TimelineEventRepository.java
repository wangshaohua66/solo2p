package com.wedding.suite.repository;

import com.wedding.suite.entity.TimelineEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TimelineEventRepository extends JpaRepository<TimelineEventEntity, Long> {
    List<TimelineEventEntity> findByWeddingIdOrderByTimeAsc(Long weddingId);
}
