package com.ems.dispatch.repository

import com.ems.dispatch.entity.MedicalRecord
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface MedicalRecordRepository : JpaRepository<MedicalRecord, Long> {
    fun findByRecordNo(recordNo: String): MedicalRecord?
    fun findByDispatchEventId(dispatchEventId: Long): MedicalRecord?
    fun findByCreatedBy(createdBy: Long): List<MedicalRecord>
    fun findByIsLockedTrue(): List<MedicalRecord>

    @Query(
        """
        SELECT m FROM MedicalRecord m 
        WHERE m.createdAt >= :startDate 
        AND m.createdAt <= :endDate
        ORDER BY m.createdAt DESC
        """
    )
    fun findByDateRange(
        @Param("startDate") startDate: LocalDateTime,
        @Param("endDate") endDate: LocalDateTime,
        pageable: Pageable
    ): Page<MedicalRecord>

    @Query(
        """
        SELECT m FROM MedicalRecord m 
        WHERE m.id NOT IN (
            SELECT q.medicalRecord.id FROM QualityControlReview q
        )
        ORDER BY m.createdAt DESC
        """
    )
    fun findRecordsPendingReview(pageable: Pageable): Page<MedicalRecord>

    @Query(
        """
        SELECT COUNT(m) FROM MedicalRecord m 
        WHERE m.createdAt >= :startDate 
        AND m.createdAt <= :endDate
        """
    )
    fun countByDateRange(
        @Param("startDate") startDate: LocalDateTime,
        @Param("endDate") endDate: LocalDateTime
    ): Long

    @Query(
        """
        SELECT m.preliminaryDiagnosis, COUNT(m) 
        FROM MedicalRecord m 
        WHERE m.createdAt >= :startDate 
        AND m.createdAt <= :endDate 
        AND m.preliminaryDiagnosis IS NOT NULL 
        GROUP BY m.preliminaryDiagnosis 
        ORDER BY COUNT(m) DESC
        """
    )
    fun countByDiagnosisInPeriod(
        @Param("startDate") startDate: LocalDateTime,
        @Param("endDate") endDate: LocalDateTime,
        pageable: Pageable
    ): List<Array<Any>>
}
