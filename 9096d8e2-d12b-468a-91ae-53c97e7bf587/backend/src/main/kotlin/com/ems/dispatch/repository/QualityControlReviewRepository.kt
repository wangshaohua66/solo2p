package com.ems.dispatch.repository

import com.ems.dispatch.entity.QualityControlReview
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface QualityControlReviewRepository : JpaRepository<QualityControlReview, Long> {
    fun findByReviewNo(reviewNo: String): QualityControlReview?
    fun findByMedicalRecordId(medicalRecordId: Long): List<QualityControlReview>
    fun findByReviewerId(reviewerId: Long): List<QualityControlReview>
    fun findByStatus(status: String): List<QualityControlReview>
    fun findByReviewedFalse(pageable: Pageable): Page<QualityControlReview>

    @Query(
        """
        SELECT q FROM QualityControlReview q 
        WHERE q.reviewDate >= :startDate 
        AND q.reviewDate <= :endDate 
        ORDER BY q.reviewDate DESC
        """
    )
    fun findByDateRange(
        @Param("startDate") startDate: LocalDateTime,
        @Param("endDate") endDate: LocalDateTime,
        pageable: Pageable
    ): Page<QualityControlReview>

    @Query(
        """
        SELECT q.status, COUNT(q) 
        FROM QualityControlReview q 
        WHERE q.reviewDate >= :startDate 
        AND q.reviewDate <= :endDate 
        GROUP BY q.status
        """
    )
    fun countByStatusInPeriod(
        @Param("startDate") startDate: LocalDateTime,
        @Param("endDate") endDate: LocalDateTime
    ): List<Array<Any>>

    @Query(
        """
        SELECT AVG(q.overallScore) 
        FROM QualityControlReview q 
        WHERE q.reviewDate >= :startDate 
        AND q.reviewDate <= :endDate 
        AND q.overallScore IS NOT NULL
        """
    )
    fun calculateAverageScoreInPeriod(
        @Param("startDate") startDate: LocalDateTime,
        @Param("endDate") endDate: LocalDateTime
    ): Double?

    @Query(
        """
        SELECT COUNT(DISTINCT q.medicalRecord.id) 
        FROM QualityControlReview q 
        WHERE q.reviewDate >= :startDate 
        AND q.reviewDate <= :endDate
        """
    )
    fun countReviewedRecordsInPeriod(
        @Param("startDate") startDate: LocalDateTime,
        @Param("endDate") endDate: LocalDateTime
    ): Long
}
