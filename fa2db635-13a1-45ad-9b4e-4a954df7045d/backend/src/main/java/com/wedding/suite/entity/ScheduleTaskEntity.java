package com.wedding.suite.entity;

import com.wedding.suite.enums.ResourceType;
import com.wedding.suite.enums.ScheduleStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "schedule_task")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleTaskEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", nullable = false, length = 8)
    private ResourceType resourceType;
    @Column(name = "resource_id", nullable = false)
    private Long resourceId;
    @Column(name = "resource_name", nullable = false, length = 64)
    private String resourceName;
    @Column(name = "wedding_id")
    private Long weddingId;
    @Column(name = "couple_name", length = 64)
    private String coupleName;
    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;
    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ScheduleStatus status;
}
