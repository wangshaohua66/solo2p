package com.scriptkill.entity;

import com.scriptkill.entity.enums.SessionStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "session_events", indexes = {
    @Index(name = "idx_event_session", columnList = "session_id"),
    @Index(name = "idx_event_timestamp", columnList = "event_timestamp"),
    @Index(name = "idx_event_type", columnList = "event_type")
})
public class SessionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private GameSession session;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    private SessionStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", length = 20)
    private SessionStatus toStatus;

    @Column(name = "triggered_by")
    private Long triggeredBy;

    @Column(name = "event_data", columnDefinition = "TEXT")
    private String eventData;

    @Column(name = "description", length = 500)
    private String description;

    @CreationTimestamp
    @Column(name = "event_timestamp", nullable = false)
    private LocalDateTime eventTimestamp;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;
}
