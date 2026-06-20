package com.tvstation.media.entity;

import com.tvstation.media.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "schedule_items", indexes = {
    @Index(name = "idx_schedule_channel", columnList = "channelId"),
    @Index(name = "idx_schedule_date", columnList = "scheduleDate"),
    @Index(name = "idx_schedule_time", columnList = "startTime, endTime"),
    @Index(name = "idx_schedule_status", columnList = "status"),
    @Index(name = "idx_schedule_topic", columnList = "topicId")
})
public class ScheduleItem extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Channel channelId;

    @Column(nullable = false, length = 200)
    private String programName;

    @Column(length = 50)
    private String programType;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Column(nullable = false)
    private Integer duration;

    private Long topicId;

    @Column(nullable = false)
    private String scheduleDate;

    @Column(nullable = false)
    private Integer sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScheduleStatus status;

    @Column(length = 100)
    private String createdBy;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 500)
    private String broadcastSystemId;

    public enum Channel {
        news, city, public
    }

    public enum ScheduleStatus {
        scheduled, broadcasting, completed, cancelled
    }
}
