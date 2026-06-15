package com.ems.dispatch.service

import com.ems.dispatch.dto.*
import com.ems.dispatch.entity.DispatchEvent
import com.ems.dispatch.entity.User
import com.ems.dispatch.repository.AmbulanceRepository
import com.ems.dispatch.repository.DispatchEventRepository
import com.ems.dispatch.repository.HospitalRepository
import com.ems.dispatch.repository.UserRepository
import com.ems.dispatch.util.EventNoGenerator
import com.ems.dispatch.util.GisUtils
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.cache.annotation.CacheEvict
import org.springframework.cache.annotation.Cacheable
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.LocalDateTime

@Service
class DispatchService(
    private val dispatchEventRepository: DispatchEventRepository,
    private val ambulanceRepository: AmbulanceRepository,
    private val hospitalRepository: HospitalRepository,
    private val userRepository: UserRepository,
    private val eventNoGenerator: EventNoGenerator,
    private val notificationService: NotificationService,
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    private val messagingTemplate: SimpMessagingTemplate,
    @Value("\${ems.dispatch.search-radius-km:5.0}")
    private val defaultSearchRadiusKm: Double
) {
    private val logger = LoggerFactory.getLogger(DispatchService::class.java)

    @Transactional
    @CacheEvict(value = ["dispatchDashboard"], allEntries = true)
    fun createEmergencyCall(request: EmergencyCallRequest, dispatcher: User): DispatchEventDetail {
        logger.info("Creating emergency call for caller: ${request.callerPhone}")

        val location = GisUtils.createPoint(request.longitude, request.latitude)
        val eventNo = eventNoGenerator.generateEventNo()

        val event = DispatchEvent(
            eventNo = eventNo,
            callerName = request.callerName,
            callerPhone = request.callerPhone,
            patientName = request.patientName,
            patientGender = request.patientGender,
            patientAge = request.patientAge,
            emergencyAddress = request.emergencyAddress,
            emergencyLocation = location,
            chiefComplaint = request.chiefComplaint,
            conditionSeverity = request.conditionSeverity,
            status = DispatchEvent.Status.PENDING.name,
            callReceivedTime = LocalDateTime.now(),
            dispatcher = dispatcher,
            remarks = request.remarks
        )

        val savedEvent = dispatchEventRepository.save(event)
        logger.info("Emergency call created with eventNo: $eventNo")

        kafkaTemplate.send("ems.dispatch.event", "CREATED", savedEvent)
        messagingTemplate.convertAndSend("/topic/dispatch/new", toSummary(savedEvent))

        return toDetail(savedEvent)
    }

    @Transactional(readOnly = true)
    fun findNearbyVehicles(request: NearbyVehicleRequest): List<VehicleRecommendation> {
        val location = GisUtils.createPoint(request.longitude, request.latitude)
        val radiusMeters = request.radiusKm * 1000

        val results = ambulanceRepository.findNearbyWithDistance(
            location, radiusMeters, request.statuses
        )

        return results.map { row ->
            val ambulance = row[0] as com.ems.dispatch.entity.Ambulance
            val distance = row[1] as Double
            VehicleRecommendation(
                ambulanceId = ambulance.id!!,
                vehicleNo = ambulance.vehicleNo,
                vehicleType = ambulance.vehicleType,
                equipmentLevel = ambulance.equipmentLevel,
                status = ambulance.status,
                distanceMeters = distance,
                estimatedArrivalMinutes = GisUtils.calculateEstimatedArrivalMinutes(distance),
                currentLocation = GisUtils.toLocationDto(ambulance.currentLocation),
                driverName = ambulance.driverName,
                driverPhone = ambulance.driverPhone
            )
        }
    }

    @Transactional
    fun dispatchVehicle(request: DispatchCommandRequest, dispatcher: User): DispatchEventDetail {
        val event = dispatchEventRepository.findById(request.eventId)
            .orElseThrow { IllegalArgumentException("Dispatch event not found: ${request.eventId}") }

        val ambulance = ambulanceRepository.findById(request.ambulanceId)
            .orElseThrow { IllegalArgumentException("Ambulance not found: ${request.ambulanceId}") }

        require(ambulance.status == com.ems.dispatch.entity.Ambulance.Status.AVAILABLE.name) {
            "Ambulance is not available for dispatch"
        }

        event.ambulance = ambulance
        event.dispatchTime = LocalDateTime.now()
        event.status = DispatchEvent.Status.DISPATCHED.name
        event.estimatedArrivalMinutes = request.estimatedArrivalMinutes
        event.remarks = request.remarks

        request.hospitalId?.let {
            event.hospital = hospitalRepository.findById(it).orElse(null)
        }

        request.doctorId?.let {
            event.doctor = userRepository.findById(it).orElse(null)
        }

        ambulance.status = com.ems.dispatch.entity.Ambulance.Status.ON_CALL.name
        ambulanceRepository.save(ambulance)

        val savedEvent = dispatchEventRepository.save(event)
        logger.info("Vehicle ${ambulance.vehicleNo} dispatched to event ${event.eventNo}")

        kafkaTemplate.send("ems.dispatch.event", "DISPATCHED", savedEvent)
        messagingTemplate.convertAndSend("/topic/dispatch/update", toSummary(savedEvent))

        notificationService.createDispatchNotification(savedEvent, ambulance)

        return toDetail(savedEvent)
    }

    @Transactional
    @CacheEvict(value = ["dispatchEvent", "dispatchDashboard"], allEntries = true)
    fun updateEventStatus(eventId: Long, request: EventStatusUpdateRequest): DispatchEventDetail {
        val event = dispatchEventRepository.findById(eventId)
            .orElseThrow { IllegalArgumentException("Dispatch event not found: $eventId") }

        val newStatus = DispatchEvent.Status.valueOf(request.status.uppercase())
        val timestamp = request.timestamp ?: LocalDateTime.now()

        when (newStatus) {
            DispatchEvent.Status.DISPATCHED -> event.dispatchTime = timestamp
            DispatchEvent.Status.EN_ROUTE -> event.vehicleDepartureTime = timestamp
            DispatchEvent.Status.ON_SCENE -> event.arrivalSceneTime = timestamp
            DispatchEvent.Status.TRANSPORTING -> event.departureSceneTime = timestamp
            DispatchEvent.Status.ARRIVED_HOSPITAL -> event.arrivalHospitalTime = timestamp
            DispatchEvent.Status.COMPLETED -> event.transferCompleteTime = timestamp
            else -> {}
        }

        event.status = newStatus.name
        request.remarks?.let { event.remarks = it }

        updateAmbulanceStatus(event, newStatus)

        val savedEvent = dispatchEventRepository.save(event)
        logger.info("Event ${event.eventNo} status updated to ${newStatus.name}")

        kafkaTemplate.send("ems.dispatch.event", "STATUS_UPDATED", savedEvent)
        messagingTemplate.convertAndSend("/topic/dispatch/update", toSummary(savedEvent))

        if (newStatus == DispatchEvent.Status.TRANSPORTING && event.hospital != null) {
            notificationService.sendHospitalPreNotification(savedEvent)
        }

        return toDetail(savedEvent)
    }

    private fun updateAmbulanceStatus(event: DispatchEvent, status: DispatchEvent.Status) {
        event.ambulance?.let { ambulance ->
            when (status) {
                DispatchEvent.Status.EN_ROUTE -> {
                    ambulance.status = com.ems.dispatch.entity.Ambulance.Status.ON_CALL.name
                }
                DispatchEvent.Status.ON_SCENE -> {
                    ambulance.status = com.ems.dispatch.entity.Ambulance.Status.ON_SCENE.name
                }
                DispatchEvent.Status.TRANSPORTING -> {
                    ambulance.status = com.ems.dispatch.entity.Ambulance.Status.TRANSPORTING.name
                }
                DispatchEvent.Status.ARRIVED_HOSPITAL -> {
                    ambulance.status = com.ems.dispatch.entity.Ambulance.Status.AT_HOSPITAL.name
                }
                DispatchEvent.Status.COMPLETED, DispatchEvent.Status.CANCELLED -> {
                    ambulance.status = com.ems.dispatch.entity.Ambulance.Status.AVAILABLE.name
                }
                else -> {}
            }
            ambulanceRepository.save(ambulance)
        }
    }

    @Transactional(readOnly = true)
    fun getActiveEvents(page: Int, size: Int): PageResponse<DispatchEventSummary> {
        val activeStatuses = listOf(
            DispatchEvent.Status.PENDING.name,
            DispatchEvent.Status.DISPATCHED.name,
            DispatchEvent.Status.EN_ROUTE.name,
            DispatchEvent.Status.ON_SCENE.name,
            DispatchEvent.Status.TRANSPORTING.name,
            DispatchEvent.Status.ARRIVED_HOSPITAL.name
        )
        val pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "callReceivedTime"))
        val pageResult = dispatchEventRepository.findActiveEvents(activeStatuses, pageRequest)
        return toPageResponse(pageResult) { toSummary(it) }
    }

    @Transactional(readOnly = true)
    @Cacheable(value = ["dispatchEvent"], key = "#eventId")
    fun getEventDetail(eventId: Long): DispatchEventDetail {
        val event = dispatchEventRepository.findById(eventId)
            .orElseThrow { IllegalArgumentException("Dispatch event not found: $eventId") }
        return toDetail(event)
    }

    @Transactional(readOnly = true)
    fun getEventsByDateRange(
        startDate: LocalDateTime,
        endDate: LocalDateTime,
        page: Int,
        size: Int
    ): PageResponse<DispatchEventSummary> {
        val pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "callReceivedTime"))
        val pageResult = dispatchEventRepository.findByDateRange(startDate, endDate, pageRequest)
        return toPageResponse(pageResult) { toSummary(it) }
    }

    @Transactional(readOnly = true)
    @Cacheable(value = ["dispatchDashboard"], key = "'realtime'")
    fun getRealtimeDashboard(): Map<String, Any> {
        val startOfDay = LocalDateTime.now().toLocalDate().atStartOfDay()

        val pendingCount = dispatchEventRepository.countByStatusAndToday(
            DispatchEvent.Status.PENDING.name, startOfDay
        )
        val completedCount = dispatchEventRepository.countByStatusAndToday(
            DispatchEvent.Status.COMPLETED.name, startOfDay
        )
        val activeCount = dispatchEventRepository.countByStatusAndToday(
            DispatchEvent.Status.EN_ROUTE.name, startOfDay
        ) + dispatchEventRepository.countByStatusAndToday(
            DispatchEvent.Status.ON_SCENE.name, startOfDay
        ) + dispatchEventRepository.countByStatusAndToday(
            DispatchEvent.Status.TRANSPORTING.name, startOfDay
        )

        val availableVehicles = ambulanceRepository.findByStatus(
            com.ems.dispatch.entity.Ambulance.Status.AVAILABLE.name
        ).size

        return mapOf(
            "pendingCalls" to pendingCount,
            "activeCalls" to activeCount,
            "completedToday" to completedCount,
            "availableVehicles" to availableVehicles,
            "timestamp" to LocalDateTime.now()
        )
    }

    private fun toSummary(event: DispatchEvent): DispatchEventSummary {
        val waitingTime = if (event.dispatchTime != null) {
            Duration.between(event.callReceivedTime, event.dispatchTime).seconds
        } else {
            Duration.between(event.callReceivedTime, LocalDateTime.now()).seconds
        }

        return DispatchEventSummary(
            id = event.id!!,
            eventNo = event.eventNo,
            callerPhone = event.callerPhone,
            patientName = event.patientName,
            emergencyAddress = event.emergencyAddress,
            emergencyLocation = GisUtils.toLocationDto(event.emergencyLocation)!!,
            chiefComplaint = event.chiefComplaint,
            conditionSeverity = event.conditionSeverity,
            status = event.status,
            ambulanceId = event.ambulance?.id,
            vehicleNo = event.ambulance?.vehicleNo,
            callReceivedTime = event.callReceivedTime,
            dispatchTime = event.dispatchTime,
            estimatedArrivalMinutes = event.estimatedArrivalMinutes,
            waitingTimeSeconds = waitingTime
        )
    }

    private fun toDetail(event: DispatchEvent): DispatchEventDetail {
        val timeline = buildTimeline(event)

        return DispatchEventDetail(
            id = event.id!!,
            eventNo = event.eventNo,
            callerName = event.callerName,
            callerPhone = event.callerPhone,
            patientName = event.patientName,
            patientGender = event.patientGender,
            patientAge = event.patientAge,
            emergencyAddress = event.emergencyAddress,
            emergencyLocation = GisUtils.toLocationDto(event.emergencyLocation)!!,
            chiefComplaint = event.chiefComplaint,
            conditionSeverity = event.conditionSeverity,
            status = event.status,
            ambulance = event.ambulance?.let {
                AmbulanceSummaryDto(
                    it.id!!, it.vehicleNo, it.vehicleType, it.equipmentLevel,
                    it.status, GisUtils.toLocationDto(it.currentLocation), it.driverName, it.driverPhone
                )
            },
            hospital = event.hospital?.let {
                HospitalSummaryDto(it.id!!, it.name, it.address, it.phone, it.level)
            },
            dispatcher = event.dispatcher?.let {
                UserSummaryDto(it.id!!, it.username, it.realName, it.roles)
            },
            doctor = event.doctor?.let {
                UserSummaryDto(it.id!!, it.username, it.realName, it.roles)
            },
            callReceivedTime = event.callReceivedTime,
            dispatchTime = event.dispatchTime,
            vehicleDepartureTime = event.vehicleDepartureTime,
            arrivalSceneTime = event.arrivalSceneTime,
            departureSceneTime = event.departureSceneTime,
            arrivalHospitalTime = event.arrivalHospitalTime,
            transferCompleteTime = event.transferCompleteTime,
            estimatedArrivalMinutes = event.estimatedArrivalMinutes,
            remarks = event.remarks,
            medicalRecordId = event.medicalRecord?.id,
            timeline = timeline
        )
    }

    private fun buildTimeline(event: DispatchEvent): List<EventTimelineItem> {
        val timeline = mutableListOf<EventTimelineItem>()
        timeline.add(EventTimelineItem("CALL_RECEIVED", event.callReceivedTime, "接到120呼入电话"))

        event.dispatchTime?.let {
            timeline.add(EventTimelineItem("DISPATCHED", it, "已派车"))
        }
        event.vehicleDepartureTime?.let {
            timeline.add(EventTimelineItem("EN_ROUTE", it, "车辆出发"))
        }
        event.arrivalSceneTime?.let {
            timeline.add(EventTimelineItem("ON_SCENE", it, "到达现场"))
        }
        event.departureSceneTime?.let {
            timeline.add(EventTimelineItem("TRANSPORTING", it, "离开现场转运中"))
        }
        event.arrivalHospitalTime?.let {
            timeline.add(EventTimelineItem("ARRIVED_HOSPITAL", it, "到达医院"))
        }
        event.transferCompleteTime?.let {
            timeline.add(EventTimelineItem("COMPLETED", it, "交接完成"))
        }

        return timeline
    }

    private fun <T, R> toPageResponse(page: Page<T>, converter: (T) -> R): PageResponse<R> {
        return PageResponse(
            content = page.content.map(converter),
            page = page.number,
            size = page.size,
            totalElements = page.totalElements,
            totalPages = page.totalPages,
            hasNext = page.hasNext(),
            hasPrevious = page.hasPrevious()
        )
    }
}
