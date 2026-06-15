package com.ems.dispatch.entity

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.locationtech.jts.geom.Point
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.LocalDate
import java.time.LocalDateTime

@Entity
@Table(name = "ambulances")
@EntityListeners(AuditingEntityListener::class)
class Ambulance(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(name = "vehicle_no", nullable = false, unique = true, length = 50)
    var vehicleNo: String,

    @Column(name = "vehicle_type", nullable = false, length = 50)
    var vehicleType: String,

    @Column(name = "equipment_level", nullable = false, length = 20)
    var equipmentLevel: String,

    @Column(nullable = false, length = 20)
    var status: String = "AVAILABLE",

    @JdbcTypeCode(SqlTypes.GEOMETRY)
    @Column(name = "current_location", columnDefinition = "geography(Point,4326)")
    var currentLocation: Point? = null,

    @Column(name = "current_station_id")
    var currentStationId: Long? = null,

    @Column(name = "driver_name", length = 100)
    var driverName: String? = null,

    @Column(name = "driver_phone", length = 20)
    var driverPhone: String? = null,

    @Column(name = "last_maintenance_date")
    var lastMaintenanceDate: LocalDate? = null,

    @Column(name = "next_maintenance_date")
    var nextMaintenanceDate: LocalDate? = null,

    var mileage: Int = 0,

    @Column(name = "fuel_level")
    var fuelLevel: Int = 100,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "equipment_status", columnDefinition = "jsonb")
    var equipmentStatus: Map<String, Any>? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),

    @OneToMany(mappedBy = "ambulance", cascade = [CascadeType.ALL])
    var locations: MutableList<AmbulanceLocation> = mutableListOf(),

    @OneToMany(mappedBy = "ambulance")
    var maintenanceRecords: MutableList<VehicleMaintenance> = mutableListOf()
) {
    enum class Status {
        AVAILABLE, ON_CALL, ON_SCENE, TRANSPORTING, AT_HOSPITAL, MAINTENANCE, OUT_OF_SERVICE
    }

    enum class EquipmentLevel {
        BASIC, ADVANCED, CRITICAL_CARE, NEONATAL
    }

    enum class VehicleType {
        REGULAR_AMBULANCE, ICU_AMBULANCE, MOBILE_ICU, RESCUE_VEHICLE, COMMAND_VEHICLE
    }
}
