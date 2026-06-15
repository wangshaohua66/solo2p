package com.ems.dispatch.entity

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.springframework.data.annotation.CreatedBy
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime

@Entity
@Table(name = "vehicle_maintenance")
@EntityListeners(AuditingEntityListener::class)
class VehicleMaintenance(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ambulance_id", nullable = false)
    var ambulance: Ambulance,

    @Column(name = "maintenance_type", nullable = false, length = 50)
    var maintenanceType: String,

    @Column(name = "maintenance_date", nullable = false)
    var maintenanceDate: LocalDate,

    @Column(name = "mileage_at_service", nullable = false)
    var mileageAtService: Int,

    @Column(columnDefinition = "TEXT")
    var description: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parts_replaced", columnDefinition = "jsonb")
    var partsReplaced: List<Map<String, Any>>? = null,

    @Column(name = "service_cost", precision = 10, scale = 2)
    var serviceCost: BigDecimal? = null,

    @Column(name = "service_station", length = 200)
    var serviceStation: String? = null,

    @Column(name = "next_maintenance_date")
    var nextMaintenanceDate: LocalDate? = null,

    @Column(name = "next_mileage_threshold")
    var nextMileageThreshold: Int? = null,

    @Column(nullable = false, length = 20)
    var status: String = "COMPLETED",

    @Column(columnDefinition = "TEXT")
    var remarks: String? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @CreatedBy
    @Column(name = "created_by")
    var createdBy: Long? = null
) {
    enum class MaintenanceType {
        ROUTINE, CORRECTIVE, PREVENTIVE, EMERGENCY, INSPECTION
    }

    enum class Status {
        SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, OVERDUE
    }
}
