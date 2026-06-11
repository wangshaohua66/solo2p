package com.scriptkill.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "session_clue_logs", indexes = {
    @Index(name = "idx_clue_log_session", columnList = "session_id"),
    @Index(name = "idx_clue_log_clue", columnList = "clue_id"),
    @Index(name = "idx_clue_log_time", columnList = "triggered_at")
})
public class SessionClueLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private GameSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clue_id", nullable = false)
    private Clue clue;

    @Column(name = "triggered_by")
    private Long triggeredBy;

    @Column(name = "triggered_at", nullable = false)
    private LocalDateTime triggeredAt;

    @Column(name = "trigger_type", length = 20)
    private String triggerType;

    @Column(name = "stage_index")
    private Integer stageIndex;

    @Column(name = "notes", length = 500)
    private String notes;
}
