package com.tvstation.media.entity;

import com.tvstation.media.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "review_items", indexes = {
    @Index(name = "idx_review_status", columnList = "status"),
    @Index(name = "idx_review_type", columnList = "type"),
    @Index(name = "idx_review_submitter", columnList = "submitterId"),
    @Index(name = "idx_review_level", columnList = "currentLevel")
})
public class ReviewItem extends BaseEntity {

    @Column(nullable = false)
    private Long topicId;

    @Column(nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReviewType type;

    @Column(nullable = false)
    private Integer currentLevel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReviewStatus status;

    @Column(nullable = false)
    private Long submitterId;

    @Column(nullable = false, length = 50)
    private String submitterName;

    @Column(nullable = false)
    private LocalDateTime submittedAt;

    @Column(length = 50)
    private String currentVersion;

    @Column(columnDefinition = "TEXT")
    private String content;

    @OneToMany(mappedBy = "reviewItem", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ReviewRecord> reviews = new ArrayList<>();

    public enum ReviewType {
        topic, material, program
    }

    public enum ReviewStatus {
        pending, reviewing, approved, rejected, completed
    }
}
