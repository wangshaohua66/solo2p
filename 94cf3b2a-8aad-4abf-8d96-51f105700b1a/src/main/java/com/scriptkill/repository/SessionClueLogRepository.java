package com.scriptkill.repository;

import com.scriptkill.entity.SessionClueLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionClueLogRepository extends JpaRepository<SessionClueLog, Long> {

    List<SessionClueLog> findBySessionIdOrderByTriggeredAtAsc(Long sessionId);

    List<SessionClueLog> findBySessionIdAndClueId(Long sessionId, Long clueId);

    boolean existsBySessionIdAndClueId(Long sessionId, Long clueId);
}
