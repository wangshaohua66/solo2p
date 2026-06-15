package com.ems.dispatch.repository

import com.ems.dispatch.entity.DispatchEvent
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface DispatchEventRepository : JpaRepository<DispatchEvent, Long> {
    fun findByEventNo(eventNo: String): DispatchEvent?
    fun findByStatus(status: String): List<DispatchEvent>
    fun findByStatusIn(statuses: List<String>): List<DispatchEvent>
    fun findByDispatcherId(dispatcherId: Long): List<DispatchEvent>
    fun findByAmbulanceId(ambulanceId: Long): List<DispatchEvent>
    fun findByCallReceivedTimeBetween(start: LocalDateTime, end: LocalDateTime): List<DispatchEvent>

    @Query(
        """
        SELECT d FROM DispatchEvent d 
        WHERE d.ambulance.id = :ambulanceId 
        AND d.status IN :statuses
        ORDER BY d.callReceivedTime DESC
        """
    )
    fun findActiveByAmbulanceId(
        @Param("ambulanceId") ambulanceId: Long,
        @Param("statuses") statuses: List<String>
    ): List<DispatchEvent>

    @Query(
        """
        SELECT d FROM DispatchEvent d 
        WHERE d.status IN :statuses 
        ORDER BY d.callReceivedTime DESC
        """
    )
    fun findActiveEvents(
        @Param("statuses") statuses: List<String>,
        pageable: Pageable
    ): Page<DispatchEvent>

    @Query(
        """
        SELECT d FROM DispatchEvent d 
        WHERE d.createdAt >= :startDate 
        AND d.createdAt <= :endDate
        """
    )
    fun findByDateRange(
        @Param("startDate") startDate: LocalDateTime,
        @Param("endDate") endDate: LocalDateTime,
        pageable: Pageable
    ): Page<DispatchEvent>

    @Query(
        """
        SELECT COUNT(d) FROM DispatchEvent d 
        WHERE d.status = :status 
        AND d.createdAt >= :startOfDay
        """
    )
    fun countByStatusAndToday(
        @Param("status") status: String,
        @Param("startOfDay") startOfDay: LocalDateTime
    ): Long

    @Query(
        """
        SELECT d.conditionSeverity, COUNT(d) 
        FROM DispatchEvent d 
        WHERE d.createdAt >= :startDate 
        AND d.createdAt <= :endDate 
        GROUP BY d.conditionSeverity
        """
    )
    fun countBySeverityInPeriod(
        @Param("startDate") startDate: LocalDateTime,
        @Param("endDate") endDate: LocalDateTime
    ): List<Array<Any>>
}
