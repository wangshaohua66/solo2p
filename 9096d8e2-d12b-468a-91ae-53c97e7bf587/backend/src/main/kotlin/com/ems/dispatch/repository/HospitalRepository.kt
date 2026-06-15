package com.ems.dispatch.repository

import com.ems.dispatch.entity.Hospital
import org.locationtech.jts.geom.Point
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface HospitalRepository : JpaRepository<Hospital, Long> {
    fun findByNameContaining(name: String): List<Hospital>
    fun findByEmergencyDepartmentTrue(): List<Hospital>

    @Query(
        """
        SELECT h FROM Hospital h 
        WHERE ST_DWithin(h.location, :location, :radius) 
        AND h.emergencyDepartment = true 
        ORDER BY ST_Distance(h.location, :location) ASC
        """
    )
    fun findNearbyHospitals(
        @Param("location") location: Point,
        @Param("radius") radius: Double
    ): List<Hospital>
}
