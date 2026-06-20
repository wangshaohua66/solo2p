package com.tvstation.media.entity;

import com.tvstation.media.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "topics", indexes = {
    @Index(name = "idx_topic_status", columnList = "status"),
    @Index(name = "idx_topic_channel", columnList = "channel"),
    @Index(name = "idx_topic_program_type", columnList = "programType"),
    @Index(name = "idx_topic_creator", columnList = "creatorId"),
    @Index(name = "idx_topic_expected_date", columnList = "expectedAirDate")
})
public class Topic extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Integer duration;

    @Column(nullable = false)
    private LocalDate expectedAirDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProgramType programType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Channel channel;

    @Column(length = 100)
    private String interviewee;

    @Column(length = 200)
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TopicStatus status;

    @Column(nullable = false)
    private Long creatorId;

    @Column(nullable = false, length = 50)
    private String creatorName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata = new HashMap<>();

    @OneToMany(mappedBy = "topic", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Task> tasks = new ArrayList<>();

    @OneToMany(mappedBy = "topic", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TopicLog> logs = new ArrayList<>();

    public enum ProgramType {
        news, feature, variety, drama
    }

    public enum Channel {
        news, city, public
    }

    public enum TopicStatus {
        draft, submitted, reviewing, approved, rejected, in_production, completed, archived
    }
}
