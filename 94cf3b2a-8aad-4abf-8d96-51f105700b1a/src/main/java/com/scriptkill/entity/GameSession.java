package com.scriptkill.entity;

import com.scriptkill.entity.enums.SessionStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "sessions", indexes = {
    @Index(name = "idx_session_script", columnList = "script_id"),
    @Index(name = "idx_session_dm", columnList = "dm_id"),
    @Index(name = "idx_session_status", columnList = "status"),
    @Index(name = "idx_session_start_time", columnList = "start_time"),
    @Index(name = "idx_session_room", columnList = "room_number")
})
public class GameSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "script_id", nullable = false)
    private Script script;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dm_id", nullable = false)
    private User dm;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SessionStatus status = SessionStatus.NOT_STARTED;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "current_stage_id")
    private Long currentStageId;

    @Column(name = "current_stage_index")
    private Integer currentStageIndex = 0;

    @Column(name = "room_number", length = 20)
    private String roomNumber;

    @Column(name = "max_players", nullable = false)
    private Integer maxPlayers;

    @Column(name = "current_players_count")
    private Integer currentPlayersCount = 0;

    @Column(name = "difficulty_factor")
    private Double difficultyFactor = 1.0;

    @Column(name = "deposit_amount")
    private Integer depositAmount = 0;

    @Column(name = "price_per_person")
    private Integer pricePerPerson = 0;

    @Column(name = "total_revenue")
    private Integer totalRevenue = 0;

    @Column(name = "dm_commission")
    private Integer dmCommission = 0;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "is_archived")
    private Boolean isArchived = false;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SessionEvent> events = new ArrayList<>();

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL)
    private List<Booking> bookings = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
