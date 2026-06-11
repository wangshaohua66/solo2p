package com.scriptkill.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@Entity
@Table(name = "dm_schedules", indexes = {
    @Index(name = "idx_schedule_dm", columnList = "dm_id"),
    @Index(name = "idx_schedule_date", columnList = "schedule_date"),
    @Index(name = "idx_schedule_session", columnList = "session_id")
})
public class DMSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dm_id", nullable = false)
    private User dm;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private GameSession session;

    @Column(name = "schedule_date", nullable = false)
    private LocalDate scheduleDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "shift_type", length = 20)
    private String shiftType;

    @Column(name = "commission_amount")
    private Integer commissionAmount = 0;

    @Column(name = "difficulty_coefficient")
    private Double difficultyCoefficient = 1.0;

    @Column(name = "player_count")
    private Integer playerCount = 0;

    @Column(name = "base_salary")
    private Integer baseSalary = 0;

    @Column(name = "bonus")
    private Integer bonus = 0;

    @Column(name = "total_earnings")
    private Integer totalEarnings = 0;

    @Column(name = "is_paid")
    private Boolean isPaid = false;

    @Column(name = "status", length = 20)
    private String status = "SCHEDULED";

    @Column(name = "notes", length = 500)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
