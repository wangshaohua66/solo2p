package com.scriptkill.repository;

import com.scriptkill.entity.GameSession;
import com.scriptkill.entity.enums.SessionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SessionRepository extends JpaRepository<GameSession, Long> {

    List<GameSession> findByStatus(SessionStatus status);

    List<GameSession> findByDmId(Long dmId);

    List<GameSession> findByScriptId(Long scriptId);

    Page<GameSession> findByStatus(SessionStatus status, Pageable pageable);

    @Query("SELECT s FROM GameSession s WHERE s.status = :status AND s.isArchived = false")
    List<GameSession> findActiveSessionsByStatus(SessionStatus status);

    @Query("SELECT s FROM GameSession s WHERE s.startTime BETWEEN :start AND :end AND s.isArchived = false")
    List<GameSession> findSessionsBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT s FROM GameSession s WHERE s.dm.id = :dmId AND s.startTime BETWEEN :start AND :end")
    List<GameSession> findDmSessionsBetween(Long dmId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT COUNT(s) FROM GameSession s WHERE s.isArchived = false AND s.status <> 'CANCELLED'")
    long countActiveSessions();

    List<GameSession> findByIsArchivedFalseAndStatusIn(List<SessionStatus> statuses);
}
