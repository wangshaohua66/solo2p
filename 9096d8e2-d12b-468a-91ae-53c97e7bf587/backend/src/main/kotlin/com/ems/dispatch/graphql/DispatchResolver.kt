package com.ems.dispatch.graphql

import com.ems.dispatch.dto.NearbyVehicleRequest
import com.ems.dispatch.entity.Ambulance
import com.ems.dispatch.entity.DispatchEvent
import com.ems.dispatch.entity.MedicalRecord
import com.ems.dispatch.repository.AmbulanceRepository
import com.ems.dispatch.repository.DispatchEventRepository
import com.ems.dispatch.repository.MedicalRecordRepository
import com.ems.dispatch.service.AmbulanceLocationService
import com.ems.dispatch.service.DispatchService
import com.ems.dispatch.util.GisUtils
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.graphql.data.method.annotation.Argument
import org.springframework.graphql.data.method.annotation.QueryMapping
import org.springframework.graphql.data.method.annotation.SchemaMapping
import org.springframework.stereotype.Controller
import java.time.LocalDateTime

@Controller
class DispatchResolver(
    private val dispatchService: DispatchService,
    private val dispatchEventRepository: DispatchEventRepository,
    private val ambulanceRepository: AmbulanceRepository,
    private val medicalRecordRepository: MedicalRecordRepository,
    private val ambulanceLocationService: AmbulanceLocationService
) {
    data class AmbulanceRecommendation(
        val ambulance: Ambulance,
        val distanceMeters: Double,
        val estimatedArrivalMinutes: Int,
        val averageSpeedKmh: Double = 60.0
    )

    data class AmbulanceLocation(
        val ambulanceId: Long,
        val plateNumber: String,
        val status: String,
        val longitude: Double,
        val latitude: Double,
        val speedKmh: Double,
        val heading: Double? = null,
        val timestamp: LocalDateTime
    )

    data class LocationPoint(
        val longitude: Double,
        val latitude: Double,
        val speedKmh: Double? = null,
        val heading: Double? = null,
        val altitude: Double? = null,
        val timestamp: LocalDateTime
    )

    data class PageResult<T>(
        val content: List<T>,
        val totalElements: Long,
        val totalPages: Int,
        val number: Int,
        val size: Int
    )

    @QueryMapping
    fun dispatchEvent(@Argument id: Long): DispatchEvent? {
        return dispatchEventRepository.findById(id).orElse(null)
    }

    @QueryMapping
    fun dispatchEvents(
        @Argument status: String?,
        @Argument severity: String?,
        @Argument startTime: LocalDateTime?,
        @Argument endTime: LocalDateTime?,
        @Argument page: Int,
        @Argument size: Int
    ): PageResult<DispatchEvent> {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        val result: Page<DispatchEvent> = when {
            status != null && severity != null && startTime != null && endTime != null ->
                dispatchEventRepository.findByStatusAndSeverityAndCreatedAtBetween(
                    status, severity, startTime, endTime, pageable
                )
            status != null ->
                dispatchEventRepository.findByStatus(status, pageable)
            startTime != null && endTime != null ->
                dispatchEventRepository.findByCreatedAtBetween(startTime, endTime, pageable)
            else ->
                dispatchEventRepository.findAll(pageable)
        }
        return PageResult(
            content = result.content,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            number = result.number,
            size = result.size
        )
    }

    @QueryMapping
    fun activeDispatchEvents(
        @Argument page: Int,
        @Argument size: Int
    ): PageResult<DispatchEvent> {
        val pageResult = dispatchService.getActiveEvents(page, size)
        val events = dispatchEventRepository.findAllById(
            pageResult.content.map { it.id }
        )
        return PageResult(
            content = events,
            totalElements = pageResult.totalElements,
            totalPages = pageResult.totalPages,
            number = pageResult.number,
            size = pageResult.size
        )
    }

    @QueryMapping
    fun ambulance(@Argument id: Long): Ambulance? {
        return ambulanceRepository.findById(id).orElse(null)
    }

    @QueryMapping
    fun ambulances(
        @Argument status: String?,
        @Argument equipmentLevel: String?,
        @Argument page: Int,
        @Argument size: Int
    ): PageResult<Ambulance> {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "plateNumber"))
        val result: Page<Ambulance> = when {
            status != null && equipmentLevel != null ->
                ambulanceRepository.findByStatusAndEquipmentLevel(status, equipmentLevel, pageable)
            status != null ->
                ambulanceRepository.findByStatus(status, pageable)
            else ->
                ambulanceRepository.findAll(pageable)
        }
        return PageResult(
            content = result.content,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            number = result.number,
            size = result.size
        )
    }

    @QueryMapping
    fun availableAmbulancesNearby(
        @Argument longitude: Double,
        @Argument latitude: Double,
        @Argument radiusKm: Float
    ): List<AmbulanceRecommendation> {
        val request = NearbyVehicleRequest(longitude, latitude, radiusKm.toDouble(), listOf("AVAILABLE"))
        return dispatchService.findNearbyVehicles(request).map {
            AmbulanceRecommendation(
                ambulance = ambulanceRepository.findById(it.ambulanceId).orElseThrow(),
                distanceMeters = it.distanceMeters,
                estimatedArrivalMinutes = it.estimatedArrivalMinutes,
                averageSpeedKmh = it.averageSpeedKmh
            )
        }
    }

    @QueryMapping
    fun ambulanceLatestLocations(): List<AmbulanceLocation> {
        return ambulanceLocationService.getAllVehiclesLatestLocation().values.map {
            AmbulanceLocation(
                ambulanceId = it.ambulanceId,
                plateNumber = it.plateNumber,
                status = it.status,
                longitude = it.longitude,
                latitude = it.latitude,
                speedKmh = it.speedKmh,
                heading = it.heading,
                timestamp = it.timestamp
            )
        }
    }

    @QueryMapping
    fun ambulanceTrack(
        @Argument ambulanceId: Long,
        @Argument startTime: LocalDateTime,
        @Argument endTime: LocalDateTime
    ): List<LocationPoint> {
        return ambulanceLocationService.getVehicleTrack(ambulanceId, startTime, endTime).map {
            LocationPoint(
                longitude = it.longitude,
                latitude = it.latitude,
                speedKmh = it.speedKmh,
                heading = it.heading,
                altitude = it.altitude,
                timestamp = it.timestamp
            )
        }
    }

    @QueryMapping
    fun medicalRecord(@Argument id: Long): MedicalRecord? {
        return medicalRecordRepository.findById(id).orElse(null)
    }

    @QueryMapping
    fun medicalRecords(
        @Argument patientName: String?,
        @Argument diagnosis: String?,
        @Argument startDate: LocalDateTime?,
        @Argument endDate: LocalDateTime?,
        @Argument isLocked: Boolean?,
        @Argument page: Int,
        @Argument size: Int
    ): PageResult<MedicalRecord> {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        val result: Page<MedicalRecord> = when {
            patientName != null ->
                medicalRecordRepository.findByPatientNameContainingIgnoreCase(patientName, pageable)
            diagnosis != null ->
                medicalRecordRepository.findByPreliminaryDiagnosisContainingIgnoreCase(diagnosis, pageable)
            startDate != null && endDate != null ->
                medicalRecordRepository.findByCreatedAtBetween(startDate, endDate, pageable)
            isLocked != null ->
                medicalRecordRepository.findByIsLocked(isLocked, pageable)
            else ->
                medicalRecordRepository.findAll(pageable)
        }
        return PageResult(
            content = result.content,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            number = result.number,
            size = result.size
        )
    }

    @QueryMapping
    fun pendingReviewRecords(
        @Argument page: Int,
        @Argument size: Int
    ): PageResult<MedicalRecord> {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        val result = medicalRecordRepository.findPendingReview(pageable)
        return PageResult(
            content = result.content,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            number = result.number,
            size = result.size
        )
    }

    @SchemaMapping(typeName = "DispatchEvent", field = "medicalRecord")
    fun getMedicalRecord(event: DispatchEvent): MedicalRecord? {
        return event.id?.let { medicalRecordRepository.findByDispatchEventId(it).orElse(null) }
    }

    @SchemaMapping(typeName = "DispatchEvent", field = "ambulance")
    fun getAmbulance(event: DispatchEvent): Ambulance? {
        return event.ambulance
    }

    @SchemaMapping(typeName = "MedicalRecord", field = "dispatchEvent")
    fun getDispatchEvent(record: MedicalRecord): DispatchEvent? {
        return record.dispatchEvent
    }
}
