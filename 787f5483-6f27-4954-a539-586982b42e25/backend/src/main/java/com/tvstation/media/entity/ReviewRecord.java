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
@Table(name = "review_records", indexes = {
    @Index(name = "idx_review_record_item", columnList = "reviewItemId"),
    @Index(name = "idx_review_record_reviewer", columnList = "reviewerId"),
    @Index(name = "idx_review_record_level", columnList = "level")
})
public class ReviewRecord extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewItemId", nullable = false)
    private ReviewItem reviewItem;

    @Column(nullable = false)
    private Integer level;

    @Column(nullable = false)
    private Long reviewerId;

    @Column(nullable = false, length = 50)
    private String reviewerName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReviewStatus status;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(nullable = false)
    private LocalDateTime reviewedAt;

    @Column(length = 50)
    private String version;

    @Column(columnDefinition = "TEXT")
    private String annotations;

    public enum ReviewStatus {
        approved, rejected, pending
    }
}
