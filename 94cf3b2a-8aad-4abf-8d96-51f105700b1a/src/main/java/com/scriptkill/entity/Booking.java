package com.scriptkill.entity;

import com.scriptkill.entity.enums.BookingStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "bookings", indexes = {
    @Index(name = "idx_booking_session", columnList = "session_id"),
    @Index(name = "idx_booking_player", columnList = "player_id"),
    @Index(name = "idx_booking_status", columnList = "status"),
    @Index(name = "idx_booking_time", columnList = "booking_time")
})
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private GameSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "player_id", nullable = false)
    private User player;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "character_id")
    private ScriptCharacter assignedCharacter;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status = BookingStatus.PENDING;

    @Column(name = "deposit_paid", nullable = false)
    private Integer depositPaid = 0;

    @Column(name = "full_price_paid")
    private Integer fullPricePaid = 0;

    @Column(name = "is_deposit_refunded")
    private Boolean isDepositRefunded = false;

    @Column(name = "booking_time")
    private LocalDateTime bookingTime;

    @Column(name = "cancel_time")
    private LocalDateTime cancelTime;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name = "check_in_time")
    private LocalDateTime checkInTime;

    @Column(name = "check_out_time")
    private LocalDateTime checkOutTime;

    @Column(name = "character_preference_1")
    private Long characterPreference1;

    @Column(name = "character_preference_2")
    private Long characterPreference2;

    @Column(name = "character_preference_3")
    private Long characterPreference3;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
