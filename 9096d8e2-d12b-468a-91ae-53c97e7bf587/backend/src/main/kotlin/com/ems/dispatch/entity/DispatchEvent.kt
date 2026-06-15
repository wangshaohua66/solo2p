package com.ems.dispatch.entity

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.locationtech.jts.geom.Point
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.LocalDateTime

@Entity
@Table(name = "dispatch_events")
@EntityListeners(AuditingEntityListener::class)
class DispatchEvent(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(name = "event_no", nullable = false, unique = true, length = 50)
    var eventNo: String,

    @Column(name = "caller_name", length = 100)
    var callerName: String? = null,

    @Column(name = "caller_phone", nullable = false, length = 20)
    var callerPhone: String,

    @Column(name = "patient_name", length = 100)
    var patientName: String? = null,

    @Column(name = "patient_gender", length = 10)
    var patientGender: String? = null,

    @Column(name = "patient_age")
    var patientAge: Int? = null,

    @Column(name = "emergency_address", nullable = false, length = 500)
    var emergencyAddress: String,

    @JdbcTypeCode(SqlTypes.GEOMETRY)
    @Column(name = "emergency_location", columnDefinition = "geography(Point,4326)", nullable = false)
    var emergencyLocation: Point,

    @Column(name = "chief_complaint", nullable = false, length = 500)
    var chiefComplaint: String,

    @Column(name = "condition_severity", nullable = false, length = 20)
    var conditionSeverity: String,

    @Column(nullable = false, length = 30)
    var status: String = "PENDING",

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ambulance_id")
    var ambulance: Ambulance? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id")
    var hospital: Hospital? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dispatcher_id")
    var dispatcher: User? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id")
    var doctor: User? = null,

    @Column(name = "call_received_time", nullable = false)
    var callReceivedTime: LocalDateTime,

    @Column(name = "dispatch_time")
    var dispatchTime: LocalDateTime? = null,

    @Column(name = "vehicle_departure_time")
    var vehicleDepartureTime: LocalDateTime? = null,

    @Column(name = "arrival_scene_time")
    var arrivalSceneTime: LocalDateTime? = null,

    @Column(name = "departure_scene_time")
    var departureSceneTime: LocalDateTime? = null,

    @Column(name = "arrival_hospital_time")
    var arrivalHospitalTime: LocalDateTime? = null,

    @Column(name = "transfer_complete_time")
    var transferCompleteTime: LocalDateTime? = null,

    @Column(name = "estimated_arrival_minutes")
    var estimatedArrivalMinutes: Int? = null,

    @Column(columnDefinition = "TEXT")
    var remarks: String? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),

    @OneToOne(mappedBy = "dispatchEvent", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    var medicalRecord: MedicalRecord? = null
) {
    enum class Status {
        PENDING, DISPATCHED, EN_ROUTE, ON_SCENE, TRANSPORTING, ARRIVED_HOSPITAL, COMPLETED, CANCELLED
    }

    enum class ConditionSeverity {
        MINOR, MODERATE, SEVERE, CRITICAL, CODE_BLUE
    }
}
