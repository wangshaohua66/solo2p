package com.tvstation.media.entity;

import com.tvstation.media.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "topic_logs", indexes = {
    @Index(name = "idx_topic_log_topic", columnList = "topicId"),
    @Index(name = "idx_topic_log_operator", columnList = "operatorId")
})
public class TopicLog extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topicId", nullable = false)
    private Topic topic;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(nullable = false)
    private Long operatorId;

    @Column(nullable = false, length = 50)
    private String operatorName;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @Column(length = 50)
    private String fromStatus;

    @Column(length = 50)
    private String toStatus;
}
