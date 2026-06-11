package com.scriptkill.repository;

import com.scriptkill.entity.SessionEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionEventRepository extends JpaRepository<SessionEvent, Long> {

    List<SessionEvent> findBySessionIdOrderByEventTimestampAsc(Long sessionId);

    List<SessionEvent> findBySessionIdAndEventType(Long sessionId, String eventType);
}
