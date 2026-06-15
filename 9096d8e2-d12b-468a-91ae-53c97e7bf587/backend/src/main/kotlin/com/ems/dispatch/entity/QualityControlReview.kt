package com.ems.dispatch.entity

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.LocalDateTime

@Entity
@Table(name = "quality_control_reviews")
@EntityListeners(AuditingEntityListener::class)
class QualityControlReview(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(name = "review_no", nullable = false, unique = true, length = 50)
    var reviewNo: String,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "medical_record_id", nullable = false)
    var medicalRecord: MedicalRecord,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id")
    var reviewer: User? = null,

    @Column(name = "review_type", nullable = false, length = 30)
    var reviewType: String,

    @Column(name = "review_date", nullable = false)
    var reviewDate: LocalDateTime = LocalDateTime.now(),

    @Column(name = "overall_score")
    var overallScore: Int? = null,

    @Column(name = "completeness_score")
    var completenessScore: Int? = null,

    @Column(name = "timeliness_score")
    var timelinessScore: Int? = null,

    @Column(name = "accuracy_score")
    var accuracyScore: Int? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    var defects: List<Map<String, Any>>? = null,

    @Column(name = "improvement_suggestions", columnDefinition = "TEXT")
    var improvementSuggestions: String? = null,

    @Column(nullable = false, length = 20)
    var status: String = "PENDING",

    var reviewed: Boolean = false,

    @Column(name = "reviewed_at")
    var reviewedAt: LocalDateTime? = null,

    @Column(name = "rectification_required")
    var rectificationRequired: Boolean = false,

    @Column(name = "rectification_deadline")
    var rectificationDeadline: LocalDateTime? = null,

    @Column(name = "rectification_completed")
    var rectificationCompleted: Boolean = false,

    @Column(name = "rectification_notes", columnDefinition = "TEXT")
    var rectificationNotes: String? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now()
) {
    enum class ReviewType {
        RANDOM_SAMPLING, COMPLAINT_INVESTIGATION, ADVERSE_EVENT, PERIODIC_REVIEW, SPOT_CHECK
    }

    enum class Status {
        PENDING, IN_REVIEW, REVIEWED, RECTIFICATION_PENDING, RECTIFIED, CLOSED
    }
}
