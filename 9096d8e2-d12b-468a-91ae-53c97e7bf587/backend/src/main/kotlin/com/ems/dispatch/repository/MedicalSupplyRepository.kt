package com.ems.dispatch.repository

import com.ems.dispatch.entity.MedicalSupply
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDate

@Repository
interface MedicalSupplyRepository : JpaRepository<MedicalSupply, Long> {
    fun findByAmbulanceId(ambulanceId: Long): List<MedicalSupply>
    fun findByItemCode(itemCode: String): List<MedicalSupply>
    fun findByCategory(category: String): List<MedicalSupply>
    fun findByStatus(status: String): List<MedicalSupply>

    @Query(
        """
        SELECT ms FROM MedicalSupply ms 
        WHERE ms.quantity <= ms.minimumStock 
        AND ms.status != 'OUT_OF_STOCK'
        """
    )
    fun findLowStockItems(): List<MedicalSupply>

    @Query(
        """
        SELECT ms FROM MedicalSupply ms 
        WHERE ms.expiryDate <= :date 
        AND ms.status != 'EXPIRED'
        """
    )
    fun findExpiringItems(@Param("date") date: LocalDate): List<MedicalSupply>

    @Query(
        """
        SELECT ms FROM MedicalSupply ms 
        WHERE ms.ambulance.id = :ambulanceId 
        AND ms.category = :category
        """
    )
    fun findByAmbulanceIdAndCategory(
        @Param("ambulanceId") ambulanceId: Long,
        @Param("category") category: String
    ): List<MedicalSupply>
}
