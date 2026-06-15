package com.ems.dispatch.repository

import com.ems.dispatch.entity.Ambulance
import org.locationtech.jts.geom.Point
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface AmbulanceRepository : JpaRepository<Ambulance, Long> {
    fun findByVehicleNo(vehicleNo: String): Ambulance?
    fun findByStatus(status: String): List<Ambulance>
    fun findByStatusIn(statuses: List<String>): List<Ambulance>
    fun existsByVehicleNo(vehicleNo: String): Boolean

    @Query(
        """
        SELECT a FROM Ambulance a 
        WHERE a.status = :status 
        AND ST_DWithin(a.currentLocation, :location, :radius) 
        ORDER BY ST_Distance(a.currentLocation, :location) ASC
        """
    )
    fun findAvailableNearby(
        @Param("location") location: Point,
        @Param("radius") radius: Double,
        @Param("status") status: String = "AVAILABLE"
    ): List<Ambulance>

    @Query(
        """
        SELECT a, ST_Distance(a.currentLocation, :location) as distance 
        FROM Ambulance a 
        WHERE a.status IN :statuses 
        AND ST_DWithin(a.currentLocation, :location, :radius) 
        ORDER BY ST_Distance(a.currentLocation, :location) ASC
        """
    )
    fun findNearbyWithDistance(
        @Param("location") location: Point,
        @Param("radius") radius: Double,
        @Param("statuses") statuses: List<String>
    ): List<Array<Any>>
}
