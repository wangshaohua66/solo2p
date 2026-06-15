package com.ems.dispatch.service

import com.ems.dispatch.dto.LocationDto
import com.ems.dispatch.entity.Ambulance
import com.ems.dispatch.entity.AmbulanceLocation
import com.ems.dispatch.entity.DispatchEvent
import com.ems.dispatch.repository.AmbulanceLocationRepository
import com.ems.dispatch.repository.AmbulanceRepository
import com.ems.dispatch.repository.DispatchEventRepository
import com.ems.dispatch.util.GisUtils
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDateTime

@Service
class AmbulanceLocationService(
    private val ambulanceLocationRepository: AmbulanceLocationRepository,
    private val ambulanceRepository: AmbulanceRepository,
    private val dispatchEventRepository: DispatchEventRepository,
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    private val messagingTemplate: SimpMessagingTemplate,
    @Value("\${ems.dispatch.geofence-radius-meters:50}")
    private val geofenceRadiusMeters: Double,
    @Value("\${ems.dispatch.gps-update-interval:3000}")
    private val gpsUpdateIntervalMs: Long
) {
    private val logger = LoggerFactory.getLogger(AmbulanceLocationService::class.java)
    private val lastUpdateTimestamps = mutableMapOf<Long, LocalDateTime>()
    private val geofenceTriggeredEvents = mutableSetOf<Pair<Long, String>>()

    data class GeofenceEvent(
        val eventId: Long,
        val eventNo: String,
        val ambulanceId: Long,
        val vehicleNo: String,
        val geofenceType: String,
        val triggered: Boolean,
        val distanceMeters: Double,
        val timestamp: LocalDateTime
    )

    data class GpsUpdateMessage(
        val ambulanceId: Long,
        val longitude: Double,
        val latitude: Double,
        val speed: BigDecimal? = null,
        val heading: Int? = null,
        val altitude: BigDecimal? = null,
        val gpsAccuracy: Int? = null,
        val ignitionStatus: Boolean? = null,
        val odometer: Int? = null,
        val timestamp: LocalDateTime = LocalDateTime.now()
    )

    data class VehicleStatusUpdate(
        val ambulanceId: Long,
        val vehicleNo: String,
        val location: LocationDto,
        val speed: BigDecimal?,
        val heading: Int?,
        val status: String,
        val timestamp: LocalDateTime
    )

    @Transactional
    @KafkaListener(topics = ["ems.vehicle.gps"], groupId = "ems-dispatch-gps")
    fun processGpsUpdate(message: GpsUpdateMessage) {
        val now = LocalDateTime.now()
        val lastUpdate = lastUpdateTimestamps[message.ambulanceId]

        if (lastUpdate != null &&
            java.time.Duration.between(lastUpdate, now).toMillis() < gpsUpdateIntervalMs
        ) {
            return
        }

        try {
            val ambulance = ambulanceRepository.findById(message.ambulanceId)
                .orElseThrow { IllegalArgumentException("Ambulance not found: ${message.ambulanceId}") }

            val location = GisUtils.createPoint(message.longitude, message.latitude)

            val locationRecord = AmbulanceLocation(
                ambulance = ambulance,
                location = location,
                speed = message.speed,
                heading = message.heading,
                altitude = message.altitude,
                gpsAccuracy = message.gpsAccuracy,
                timestamp = message.timestamp,
                ignitionStatus = message.ignitionStatus,
                odometer = message.odometer
            )
            ambulanceLocationRepository.save(locationRecord)

            ambulance.currentLocation = location
            message.odometer?.let { ambulance.mileage = it }
            ambulanceRepository.save(ambulance)

            checkSpeedAlert(ambulance, message.speed)
            checkGeofence(ambulance, location)

            lastUpdateTimestamps[message.ambulanceId] = now

            val statusUpdate = VehicleStatusUpdate(
                ambulanceId = ambulance.id!!,
                vehicleNo = ambulance.vehicleNo,
                location = GisUtils.toLocationDto(location)!!,
                speed = message.speed,
                heading = message.heading,
                status = ambulance.status,
                timestamp = message.timestamp
            )

            messagingTemplate.convertAndSend("/topic/vehicle/location", statusUpdate)

        } catch (e: Exception) {
            logger.error("Error processing GPS update for ambulance ${message.ambulanceId}", e)
        }
    }

    @Transactional
    fun reportGpsUpdate(message: GpsUpdateMessage): Boolean {
        kafkaTemplate.send("ems.vehicle.gps", message.ambulanceId.toString(), message)
        return true
    }

    @Transactional(readOnly = true)
    fun getVehicleTrack(ambulanceId: Long, startTime: LocalDateTime, endTime: LocalDateTime): List<LocationDto> {
        val track = ambulanceLocationRepository.findTrackByAmbulanceAndTimeRange(
            ambulanceId, startTime, endTime
        )
        return track.mapNotNull { GisUtils.toLocationDto(it.location) }
    }

    @Transactional(readOnly = true)
    fun getLatestLocation(ambulanceId: Long): LocationDto? {
        val location = ambulanceLocationRepository.findLatestByAmbulanceId(ambulanceId)
        return location?.let { GisUtils.toLocationDto(it.location) }
    }

    @Transactional(readOnly = true)
    fun getAllVehiclesLatestLocation(): Map<Long, VehicleStatusUpdate> {
        val ambulances = ambulanceRepository.findAll()
        return ambulances.mapNotNull { ambulance ->
            val latest = ambulanceLocationRepository.findLatestByAmbulanceId(ambulance.id!!)
            latest?.let {
                ambulance.id to VehicleStatusUpdate(
                    ambulanceId = ambulance.id!!,
                    vehicleNo = ambulance.vehicleNo,
                    location = GisUtils.toLocationDto(it.location)!!,
                    speed = it.speed,
                    heading = it.heading,
                    status = ambulance.status,
                    timestamp = it.timestamp
                )
            }
        }.toMap()
    }

    private fun checkSpeedAlert(ambulance: Ambulance, speed: BigDecimal?) {
        val speedLimit = 120.0
        if (speed != null && speed.toDouble() > speedLimit) {
            logger.warn("Speed alert: ambulance ${ambulance.vehicleNo} is speeding at ${speed}km/h")

            val alert = mapOf(
                "type" to "SPEEDING",
                "ambulanceId" to ambulance.id,
                "vehicleNo" to ambulance.vehicleNo,
                "speed" to speed,
                "speedLimit" to speedLimit,
                "timestamp" to LocalDateTime.now()
            )
            kafkaTemplate.send("ems.notification", "SPEED_ALERT", alert)
            messagingTemplate.convertAndSend("/topic/vehicle/alert", alert)
        }
    }

    private fun checkGeofence(ambulance: Ambulance, currentLocation: org.locationtech.jts.geom.Point) {
        val activeStatuses = listOf(
            DispatchEvent.Status.EN_ROUTE.name,
            DispatchEvent.Status.ON_SCENE.name,
            DispatchEvent.Status.TRANSPORTING.name
        )

        val activeEvents = dispatchEventRepository.findActiveByAmbulanceId(
            ambulance.id!!,
            activeStatuses
        )

        if (activeEvents.isEmpty()) {
            return
        }

        logger.debug("Checking geofence for ambulance ${ambulance.vehicleNo}, active events: ${activeEvents.size}")

        activeEvents.forEach { event ->
            when (event.status) {
                DispatchEvent.Status.EN_ROUTE.name -> {
                    checkSceneGeofence(event, ambulance, currentLocation)
                }
                DispatchEvent.Status.TRANSPORTING.name -> {
                    checkHospitalGeofence(event, ambulance, currentLocation)
                }
            }
        }
    }

    private fun checkSceneGeofence(
        event: DispatchEvent,
        ambulance: Ambulance,
        currentLocation: org.locationtech.jts.geom.Point
    ) {
        val cacheKey = event.id!! to "SCENE_ARRIVED"
        if (geofenceTriggeredEvents.contains(cacheKey)) {
            return
        }

        val distance = GisUtils.calculateDistanceMeters(currentLocation, event.emergencyLocation)

        if (distance <= geofenceRadiusMeters) {
            logger.info("Scene geofence triggered: ambulance ${ambulance.vehicleNo} arrived at scene for event ${event.eventNo}, distance: ${String.format("%.2f", distance)}m")

            event.status = DispatchEvent.Status.ON_SCENE.name
            event.arrivalSceneTime = LocalDateTime.now()
            dispatchEventRepository.save(event)

            ambulance.status = Ambulance.Status.ON_SCENE.name
            ambulanceRepository.save(ambulance)

            geofenceTriggeredEvents.add(cacheKey)

            val geofenceEvent = GeofenceEvent(
                eventId = event.id!!,
                eventNo = event.eventNo,
                ambulanceId = ambulance.id!!,
                vehicleNo = ambulance.vehicleNo,
                geofenceType = "SCENE",
                triggered = true,
                distanceMeters = distance,
                timestamp = LocalDateTime.now()
            )

            kafkaTemplate.send("ems.dispatch.event", "GEOFENCE_SCENE", geofenceEvent)
            messagingTemplate.convertAndSend("/topic/dispatch/geofence/scene", geofenceEvent)
            messagingTemplate.convertAndSend("/topic/dispatch/event/${event.id}/update", event)

            val notification = mapOf(
                "type" to "SCENE_ARRIVAL",
                "eventId" to event.id,
                "eventNo" to event.eventNo,
                "vehicleNo" to ambulance.vehicleNo,
                "message" to "车辆${ambulance.vehicleNo}已到达现场",
                "timestamp" to LocalDateTime.now()
            )
            kafkaTemplate.send("ems.notification", "SCENE_ARRIVAL", notification)
            messagingTemplate.convertAndSend("/topic/notifications", notification)
        }
    }

    private fun checkHospitalGeofence(
        event: DispatchEvent,
        ambulance: Ambulance,
        currentLocation: org.locationtech.jts.geom.Point
    ) {
        val cacheKey = event.id!! to "HOSPITAL_ARRIVED"
        if (geofenceTriggeredEvents.contains(cacheKey)) {
            return
        }

        val hospital = event.hospital
        if (hospital == null || hospital.location == null) {
            return
        }

        val distance = GisUtils.calculateDistanceMeters(currentLocation, hospital.location!!)

        if (distance <= geofenceRadiusMeters) {
            logger.info("Hospital geofence triggered: ambulance ${ambulance.vehicleNo} arrived at hospital for event ${event.eventNo}, distance: ${String.format("%.2f", distance)}m")

            event.status = DispatchEvent.Status.ARRIVED_HOSPITAL.name
            event.arrivalHospitalTime = LocalDateTime.now()
            dispatchEventRepository.save(event)

            ambulance.status = Ambulance.Status.AT_HOSPITAL.name
            ambulanceRepository.save(ambulance)

            geofenceTriggeredEvents.add(cacheKey)

            val geofenceEvent = GeofenceEvent(
                eventId = event.id!!,
                eventNo = event.eventNo,
                ambulanceId = ambulance.id!!,
                vehicleNo = ambulance.vehicleNo,
                geofenceType = "HOSPITAL",
                triggered = true,
                distanceMeters = distance,
                timestamp = LocalDateTime.now()
            )

            kafkaTemplate.send("ems.dispatch.event", "GEOFENCE_HOSPITAL", geofenceEvent)
            messagingTemplate.convertAndSend("/topic/dispatch/geofence/hospital", geofenceEvent)
            messagingTemplate.convertAndSend("/topic/dispatch/event/${event.id}/update", event)

            val notification = mapOf(
                "type" to "HOSPITAL_ARRIVAL",
                "eventId" to event.id,
                "eventNo" to event.eventNo,
                "vehicleNo" to ambulance.vehicleNo,
                "hospitalId" to hospital.id,
                "hospitalName" to hospital.name,
                "message" to "车辆${ambulance.vehicleNo}已到达${hospital.name}",
                "timestamp" to LocalDateTime.now()
            )
            kafkaTemplate.send("ems.notification", "HOSPITAL_ARRIVAL", notification)
            messagingTemplate.convertAndSend("/topic/notifications", notification)
            messagingTemplate.convertAndSend("/topic/hospital/${hospital.id}/arrival", event)
        }
    }

    fun isVehicleNearLocation(
        ambulanceId: Long,
        targetLocation: org.locationtech.jts.geom.Point,
        radiusMeters: Double
    ): Boolean {
        val latest = ambulanceLocationRepository.findLatestByAmbulanceId(ambulanceId)
            ?: return false
        return GisUtils.isPointWithinRadius(targetLocation, latest.location, radiusMeters)
    }

    @Transactional
    fun processLocationUpdate(locationDto: LocationDto) {
        val now = LocalDateTime.now()
        val lastUpdate = lastUpdateTimestamps[locationDto.ambulanceId]

        if (lastUpdate != null &&
            java.time.Duration.between(lastUpdate, now).toMillis() < gpsUpdateIntervalMs
        ) {
            return
        }

        try {
            val ambulance = ambulanceRepository.findById(locationDto.ambulanceId)
                .orElseThrow { IllegalArgumentException("Ambulance not found: ${locationDto.ambulanceId}") }

            val location = GisUtils.createPoint(locationDto.longitude, locationDto.latitude)

            val locationRecord = AmbulanceLocation(
                ambulance = ambulance,
                location = location,
                speed = locationDto.speedKmh?.toBigDecimal(),
                heading = locationDto.heading?.toInt(),
                altitude = locationDto.altitude?.toBigDecimal(),
                gpsAccuracy = locationDto.accuracy?.toInt(),
                timestamp = LocalDateTime.parse(locationDto.timestamp)
            )
            ambulanceLocationRepository.save(locationRecord)

            ambulance.currentLocation = location
            ambulanceRepository.save(ambulance)

            locationDto.speedKmh?.let {
                checkSpeedAlert(ambulance, it.toBigDecimal())
            }
            checkGeofence(ambulance, location)

            lastUpdateTimestamps[locationDto.ambulanceId] = now

            val statusUpdate = VehicleStatusUpdate(
                ambulanceId = ambulance.id!!,
                vehicleNo = ambulance.vehicleNo,
                location = locationDto,
                speed = locationDto.speedKmh?.toBigDecimal(),
                heading = locationDto.heading?.toInt(),
                status = ambulance.status,
                timestamp = LocalDateTime.now()
            )

            messagingTemplate.convertAndSend("/topic/vehicle/location", statusUpdate)
            kafkaTemplate.send("ems.vehicle.gps", ambulance.id.toString(), statusUpdate)

        } catch (e: Exception) {
            logger.error("Error processing location update for ambulance ${locationDto.ambulanceId}", e)
        }
    }

    @Transactional
    fun cleanupOldLocations(before: LocalDateTime) {
        val deleted = ambulanceLocationRepository.deleteByTimestampBefore(before)
        logger.info("Cleaned up $deleted old location records")
    }
}
