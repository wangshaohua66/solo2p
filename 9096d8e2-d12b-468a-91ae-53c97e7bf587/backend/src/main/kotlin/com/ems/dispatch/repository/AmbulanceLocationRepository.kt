package com.ems.dispatch.repository

import com.ems.dispatch.entity.AmbulanceLocation
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface AmbulanceLocationRepository : JpaRepository<AmbulanceLocation, Long> {
    fun findByAmbulanceIdOrderByTimestampDesc(ambulanceId: Long): List<AmbulanceLocation>

    @Query(
        """
        SELECT l FROM AmbulanceLocation l 
        WHERE l.ambulance.id = :ambulanceId 
        AND l.timestamp >= :startTime 
        AND l.timestamp <= :endTime 
        ORDER BY l.timestamp ASC
        """
    )
    fun findTrackByAmbulanceAndTimeRange(
        @Param("ambulanceId") ambulanceId: Long,
        @Param("startTime") startTime: LocalDateTime,
        @Param("endTime") endTime: LocalDateTime
    ): List<AmbulanceLocation>

    @Query(
        """
        SELECT l FROM AmbulanceLocation l 
        WHERE l.ambulance.id = :ambulanceId 
        ORDER BY l.timestamp DESC 
        LIMIT 1
        """
    )
    fun findLatestByAmbulanceId(@Param("ambulanceId") ambulanceId: Long): AmbulanceLocation?

    fun deleteByTimestampBefore(timestamp: LocalDateTime)
}
