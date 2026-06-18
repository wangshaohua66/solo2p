package com.wedding.suite.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "timeline_event")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TimelineEventEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "wedding_id", nullable = false)
    private Long weddingId;
    @Column(nullable = false)
    private LocalDateTime time;
    @Column(nullable = false, length = 64)
    private String title;
    @Column(name = "desc_text", length = 255)
    private String descText;
    @Column(length = 32)
    private String actor;
}
