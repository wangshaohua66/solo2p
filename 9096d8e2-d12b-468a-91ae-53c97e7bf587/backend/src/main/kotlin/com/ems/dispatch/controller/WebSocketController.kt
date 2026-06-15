package com.ems.dispatch.controller

import com.ems.dispatch.dto.LocationDto
import com.ems.dispatch.service.AmbulanceLocationService
import com.ems.dispatch.service.NotificationService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.slf4j.LoggerFactory
import org.springframework.messaging.handler.annotation.DestinationVariable
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.SendTo
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.*

@Tag(name = "WebSocket消息", description = "实时消息推送与GPS位置上报接口")
@Controller
@RequestMapping("/api/ws")
class WebSocketController(
    private val notificationService: NotificationService,
    private val ambulanceLocationService: AmbulanceLocationService,
    private val messagingTemplate: SimpMessagingTemplate
) {
    private val logger = LoggerFactory.getLogger(WebSocketController::class.java)

    data class HospitalAckRequest(
        val notificationId: Long,
        val confirmed: Boolean,
        val remark: String?
    )

    data class GpsLocationMessage(
        val ambulanceId: Long,
        val plateNumber: String,
        val longitude: Double,
        val latitude: Double,
        val speedKmh: Double? = 0.0,
        val heading: Double? = null,
        val altitude: Double? = null,
        val accuracy: Double? = null,
        val timestamp: String
    )

    data class VehicleStatusMessage(
        val ambulanceId: Long,
        val status: String,
        val eventId: Long? = null,
        val remark: String?
    )

    @MessageMapping("/gps/location")
    @SendTo("/topic/vehicles/locations")
    @Operation(summary = "WebSocket GPS位置上报", description = "车辆通过WebSocket实时上报GPS位置信息")
    fun handleGpsLocation(@Valid message: GpsLocationMessage): LocationDto {
        logger.debug("Received GPS location via WebSocket: ${message.plateNumber} at ${message.longitude}, ${message.latitude}")

        val locationDto = LocationDto(
            ambulanceId = message.ambulanceId,
            longitude = message.longitude,
            latitude = message.latitude,
            speedKmh = message.speedKmh,
            heading = message.heading,
            altitude = message.altitude,
            accuracy = message.accuracy,
            timestamp = message.timestamp
        )

        runCatching {
            ambulanceLocationService.processLocationUpdate(locationDto)
        }.onFailure {
            logger.error("Failed to process GPS location", it)
        }

        return locationDto
    }

    @MessageMapping("/gps/batch")
    @Operation(summary = "批量GPS位置上报", description = "车辆终端批量上报多条GPS轨迹数据")
    fun handleBatchGpsLocation(messages: List<GpsLocationMessage>) {
        logger.debug("Received batch GPS locations: ${messages.size} records")

        messages.forEach { message ->
            runCatching {
                val locationDto = LocationDto(
                    ambulanceId = message.ambulanceId,
                    longitude = message.longitude,
                    latitude = message.latitude,
                    speedKmh = message.speedKmh,
                    heading = message.heading,
                    altitude = message.altitude,
                    accuracy = message.accuracy,
                    timestamp = message.timestamp
                )
                ambulanceLocationService.processLocationUpdate(locationDto)
            }.onFailure {
                logger.error("Failed to process GPS location for ambulance ${message.ambulanceId}", it)
            }
        }
    }

    @MessageMapping("/vehicle/status")
    @SendTo("/topic/vehicles/status")
    @Operation(summary = "车辆状态变更上报", description = "车辆上报状态变更信息")
    fun handleVehicleStatusChange(@Valid message: VehicleStatusMessage): VehicleStatusMessage {
        logger.info("Vehicle status change: ambulance ${message.ambulanceId} -> ${message.status}")

        messagingTemplate.convertAndSend(
            "/topic/vehicle/${message.ambulanceId}/status",
            message
        )

        if (message.status == "ON_SCENE" || message.status == "TRANSPORTING") {
            notificationService.createAlert(
                type = "VEHICLE_STATUS_ALERT",
                title = "车辆状态变更",
                content = "车辆 ${message.ambulanceId} 状态变更为 ${message.status}",
                priority = "NORMAL"
            )
        }

        return message
    }

    @MessageMapping("/hospital/{hospitalId}/ack")
    @Operation(summary = "医院预通知确认", description = "急诊科确认收到患者预通知")
    fun handleHospitalAck(
        @DestinationVariable hospitalId: Long,
        request: HospitalAckRequest
    ) {
        logger.info("Hospital $hospitalId acknowledged notification ${request.notificationId}")

        runCatching {
            notificationService.acknowledgeHospitalNotification(request.notificationId)
        }.onSuccess {
            messagingTemplate.convertAndSend(
                "/topic/dispatch/event/${request.notificationId}/hospital-ack",
                mapOf(
                    "notificationId" to request.notificationId,
                    "hospitalId" to hospitalId,
                    "confirmed" to request.confirmed,
                    "remark" to request.remark
                )
            )
        }.onFailure {
            logger.error("Failed to acknowledge hospital notification", it)
        }
    }

    @PostMapping("/hospital/{hospitalId}/ack")
    @Operation(summary = "医院预通知确认(REST)", description = "急诊科通过REST接口确认收到患者预通知")
    fun acknowledgeHospitalNotification(
        @PathVariable hospitalId: Long,
        @RequestBody request: HospitalAckRequest
    ): Map<String, Any> {
        logger.info("Hospital $hospitalId acknowledged notification ${request.notificationId} via REST")

        return runCatching {
            val success = notificationService.acknowledgeHospitalNotification(request.notificationId)
            mapOf(
                "success" to success,
                "message" to "确认已接收",
                "timestamp" to System.currentTimeMillis()
            )
        }.getOrElse {
            mapOf(
                "success" to false,
                "message" to "确认失败: ${it.message}"
            )
        }
    }

    @PostMapping("/notifications/{id}/read")
    @Operation(summary = "标记通知已读", description = "用户标记通知为已读状态")
    fun markNotificationAsRead(@PathVariable id: Long): Map<String, Any> {
        return runCatching {
            val success = notificationService.markAsRead(id)
            mapOf(
                "success" to success,
                "message" to if (success) "已标记为已读" else "标记失败"
            )
        }.getOrElse {
            mapOf(
                "success" to false,
                "message" to it.message.orEmpty()
            )
        }
    }

    @GetMapping("/users/{userId}/notifications")
    @Operation(summary = "获取用户通知列表", description = "获取指定用户的所有通知消息")
    fun getUserNotifications(@PathVariable userId: Long): List<NotificationService.NotificationDto> {
        return notificationService.getUserNotifications(userId)
    }

    @GetMapping("/users/{userId}/notifications/unread-count")
    @Operation(summary = "获取未读通知数量", description = "获取指定用户的未读通知数量")
    fun getUnreadNotificationCount(@PathVariable userId: Long): Map<String, Long> {
        return mapOf("count" to notificationService.getUnreadCount(userId))
    }

    @GetMapping("/topics")
    @Operation(summary = "获取可用主题列表", description = "获取所有可订阅的WebSocket主题")
    fun getAvailableTopics(): Map<String, List<String>> {
        return mapOf(
            "publicTopics" to listOf(
                "/topic/notifications - 全局通知",
                "/topic/vehicles/locations - 所有车辆位置更新",
                "/topic/vehicles/status - 所有车辆状态变更",
                "/topic/dispatch/events - 调度事件更新"
            ),
            "userTopics" to listOf(
                "/user/queue/notifications - 个人通知队列"
            ),
            "hospitalTopics" to listOf(
                "/topic/hospital/{hospitalId}/pre-notification - 医院预通知",
                "/topic/hospital/{hospitalId}/patient-updates - 患者状态更新"
            ),
            "vehicleTopics" to listOf(
                "/topic/vehicle/{vehicleId}/status - 指定车辆状态",
                "/topic/vehicle/{vehicleId}/location - 指定车辆位置"
            ),
            "dispatchTopics" to listOf(
                "/topic/dispatch/event/{eventId}/updates - 事件详情更新",
                "/topic/dispatch/event/{eventId}/hospital-ack - 医院确认回执"
            )
        )
    }

    @MessageMapping("/dispatch/heartbeat")
    @Operation(summary = "调度员心跳", description = "调度员客户端定时发送心跳保持连接活跃")
    fun handleDispatcherHeartbeat(message: Map<String, Any>) {
        val dispatcherId = message["dispatcherId"] as? Long
        logger.debug("Heartbeat received from dispatcher: $dispatcherId")
    }
}
