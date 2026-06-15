package com.ems.dispatch.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import java.math.BigDecimal
import java.time.LocalDateTime

data class EmergencyCallRequest(
    @field:NotBlank(message = "Caller phone is required")
    val callerPhone: String,
    val callerName: String? = null,
    val patientName: String? = null,
    val patientGender: String? = null,
    val patientAge: Int? = null,
    @field:NotBlank(message = "Emergency address is required")
    val emergencyAddress: String,
    @field:NotNull(message = "Emergency location is required")
    val longitude: Double,
    @field:NotNull(message = "Emergency location is required")
    val latitude: Double,
    @field:NotBlank(message = "Chief complaint is required")
    val chiefComplaint: String,
    @field:NotBlank(message = "Condition severity is required")
    val conditionSeverity: String,
    val remarks: String? = null
)

data class DispatchCommandRequest(
    @field:NotNull(message = "Event ID is required")
    val eventId: Long,
    @field:NotNull(message = "Ambulance ID is required")
    val ambulanceId: Long,
    val doctorId: Long? = null,
    val hospitalId: Long? = null,
    val estimatedArrivalMinutes: Int? = null,
    val remarks: String? = null
)

data class EventStatusUpdateRequest(
    @field:NotBlank(message = "Status is required")
    val status: String,
    val remarks: String? = null,
    val timestamp: LocalDateTime? = null
)

data class NearbyVehicleRequest(
    val longitude: Double,
    val latitude: Double,
    val radiusKm: Double = 5.0,
    val statuses: List<String> = listOf("AVAILABLE")
)

data class VehicleRecommendation(
    val ambulanceId: Long,
    val vehicleNo: String,
    val vehicleType: String,
    val equipmentLevel: String,
    val status: String,
    val distanceMeters: Double,
    val estimatedArrivalMinutes: Int,
    val currentLocation: LocationDto? = null,
    val driverName: String? = null,
    val driverPhone: String? = null
)

data class LocationDto(
    val longitude: Double,
    val latitude: Double
)

data class DispatchEventSummary(
    val id: Long,
    val eventNo: String,
    val callerPhone: String,
    val patientName: String?,
    val emergencyAddress: String,
    val emergencyLocation: LocationDto,
    val chiefComplaint: String,
    val conditionSeverity: String,
    val status: String,
    val ambulanceId: Long?,
    val vehicleNo: String?,
    val callReceivedTime: LocalDateTime,
    val dispatchTime: LocalDateTime?,
    val estimatedArrivalMinutes: Int?,
    val waitingTimeSeconds: Long?
)

data class DispatchEventDetail(
    val id: Long,
    val eventNo: String,
    val callerName: String?,
    val callerPhone: String,
    val patientName: String?,
    val patientGender: String?,
    val patientAge: Int?,
    val emergencyAddress: String,
    val emergencyLocation: LocationDto,
    val chiefComplaint: String,
    val conditionSeverity: String,
    val status: String,
    val ambulance: AmbulanceSummaryDto?,
    val hospital: HospitalSummaryDto?,
    val dispatcher: UserSummaryDto?,
    val doctor: UserSummaryDto?,
    val callReceivedTime: LocalDateTime,
    val dispatchTime: LocalDateTime?,
    val vehicleDepartureTime: LocalDateTime?,
    val arrivalSceneTime: LocalDateTime?,
    val departureSceneTime: LocalDateTime?,
    val arrivalHospitalTime: LocalDateTime?,
    val transferCompleteTime: LocalDateTime?,
    val estimatedArrivalMinutes: Int?,
    val remarks: String?,
    val medicalRecordId: Long?,
    val timeline: List<EventTimelineItem>
)

data class EventTimelineItem(
    val status: String,
    val timestamp: LocalDateTime,
    val description: String
)

data class AmbulanceSummaryDto(
    val id: Long,
    val vehicleNo: String,
    val vehicleType: String,
    val equipmentLevel: String,
    val status: String,
    val currentLocation: LocationDto?,
    val driverName: String?,
    val driverPhone: String?
)

data class HospitalSummaryDto(
    val id: Long,
    val name: String,
    val address: String?,
    val phone: String?,
    val level: String?
)

data class UserSummaryDto(
    val id: Long,
    val username: String,
    val realName: String,
    val roles: String
)
