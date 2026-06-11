package com.scriptkill.service;

import com.scriptkill.entity.GameSession;
import com.scriptkill.entity.enums.SessionStatus;
import com.scriptkill.repository.SessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ArchiveService {

    private static final Logger log = LoggerFactory.getLogger(ArchiveService.class);

    private final SessionRepository sessionRepository;
    private final JdbcTemplate jdbcTemplate;

    @Value("${scriptkill.archive.retention-days:90}")
    private int retentionDays;

    public ArchiveService(SessionRepository sessionRepository, JdbcTemplate jdbcTemplate) {
        this.sessionRepository = sessionRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Scheduled(cron = "${scriptkill.archive.cron:0 0 3 * * ?}")
    @Transactional
    public int runArchiveJob() {
        log.info("Start archive job, retentionDays={}", retentionDays);
        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        return archiveSessionsBefore(cutoff);
    }

    @Transactional
    public int archiveSessionsBefore(LocalDateTime cutoffTime) {
        List<GameSession> candidates = sessionRepository
                .findByIsArchivedFalseAndStatusIn(
                        List.of(SessionStatus.COMPLETED, SessionStatus.CANCELLED));

        int archived = 0;
        for (GameSession session : candidates) {
            LocalDateTime ts = session.getEndTime() != null ? session.getEndTime()
                    : session.getUpdatedAt();
            if (ts.isAfter(cutoffTime)) {
                continue;
            }
            try {
                copyToColdTable(session);
                session.setIsArchived(true);
                sessionRepository.save(session);
                archived++;
            } catch (Exception e) {
                log.error("Archive session {} failed: {}", session.getId(), e.getMessage());
            }
        }
        log.info("Archive job finished, archived={}", archived);
        return archived;
    }

    private void copyToColdTable(GameSession session) {
        String sql = "INSERT OR IGNORE INTO cold_sessions (" +
                "id, script_id, dm_id, status, start_time, end_time, room_number, " +
                "max_players, current_players_count, difficulty_factor, deposit_amount, " +
                "price_per_person, total_revenue, dm_commission, notes, " +
                "original_created_at, archived_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
        jdbcTemplate.update(sql,
                session.getId(),
                session.getScript() != null ? session.getScript().getId() : null,
                session.getDm() != null ? session.getDm().getId() : null,
                session.getStatus() != null ? session.getStatus().name() : null,
                session.getStartTime() != null ? java.sql.Timestamp.valueOf(session.getStartTime()) : null,
                session.getEndTime() != null ? java.sql.Timestamp.valueOf(session.getEndTime()) : null,
                session.getRoomNumber(),
                session.getMaxPlayers(),
                session.getCurrentPlayersCount(),
                session.getDifficultyFactor(),
                session.getDepositAmount(),
                session.getPricePerPerson(),
                session.getTotalRevenue(),
                session.getDmCommission(),
                session.getNotes(),
                session.getCreatedAt() != null ? java.sql.Timestamp.valueOf(session.getCreatedAt()) : null,
                java.sql.Timestamp.valueOf(LocalDateTime.now()));
    }

    @Transactional(readOnly = true)
    public long countColdSessions() {
        Long c = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM cold_sessions", Long.class);
        return c != null ? c : 0L;
    }
}
