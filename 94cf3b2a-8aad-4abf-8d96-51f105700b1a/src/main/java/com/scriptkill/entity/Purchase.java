package com.scriptkill.entity;

import com.scriptkill.entity.enums.PurchaseStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "purchases", indexes = {
    @Index(name = "idx_purchase_status", columnList = "status"),
    @Index(name = "idx_purchase_script_name", columnList = "script_name"),
    @Index(name = "idx_purchase_submitter", columnList = "submitter_id")
})
public class Purchase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "script_name", nullable = false, length = 100)
    private String scriptName;

    @Column(name = "script_description", columnDefinition = "TEXT")
    private String scriptDescription;

    @Column(name = "author", length = 50)
    private String author;

    @Column(name = "publisher", length = 100)
    private String publisher;

    @Column(name = "player_count", length = 20)
    private String playerCount;

    @Column(name = "estimated_duration", length = 20)
    private String estimatedDuration;

    @Column(name = "genre", length = 50)
    private String genre;

    @Column(name = "difficulty", length = 20)
    private String difficulty;

    @Column(name = "purchase_price")
    private Integer purchasePrice;

    @Column(name = "sample_content", columnDefinition = "TEXT")
    private String sampleContent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PurchaseStatus status = PurchaseStatus.PENDING_REVIEW;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitter_id")
    private User submitter;

    @Column(name = "reviewer_1_id")
    private Long reviewer1Id;

    @Column(name = "reviewer_1_score")
    private Integer reviewer1Score;

    @Column(name = "reviewer_1_comment", length = 500)
    private String reviewer1Comment;

    @Column(name = "reviewer_2_id")
    private Long reviewer2Id;

    @Column(name = "reviewer_2_score")
    private Integer reviewer2Score;

    @Column(name = "reviewer_2_comment", length = 500)
    private String reviewer2Comment;

    @Column(name = "reviewer_3_id")
    private Long reviewer3Id;

    @Column(name = "reviewer_3_score")
    private Integer reviewer3Score;

    @Column(name = "reviewer_3_comment", length = 500)
    private String reviewer3Comment;

    @Column(name = "average_score")
    private Double averageScore;

    @Column(name = "passing_score")
    private Integer passingScore = 60;

    @Column(name = "result_script_id")
    private Long resultScriptId;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
