package com.ems.dispatch.repository

import com.ems.dispatch.entity.VehicleMaintenance
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDate

@Repository
interface VehicleMaintenanceRepository : JpaRepository<VehicleMaintenance, Long> {
    fun findByAmbulanceIdOrderByMaintenanceDateDesc(ambulanceId: Long): List<VehicleMaintenance>
    fun findByStatus(status: String): List<VehicleMaintenance>

    @Query(
        """
        SELECT vm FROM VehicleMaintenance vm 
        WHERE vm.nextMaintenanceDate <= :date 
        AND vm.status = 'COMPLETED'
        """
    )
    fun findDueForMaintenance(@Param("date") date: LocalDate): List<VehicleMaintenance>

    @Query(
        """
        SELECT vm FROM VehicleMaintenance vm 
        WHERE vm.maintenanceDate >= :startDate 
        AND vm.maintenanceDate <= :endDate 
        ORDER BY vm.maintenanceDate DESC
        """
    )
    fun findByDateRange(
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate
    ): List<VehicleMaintenance>
}
