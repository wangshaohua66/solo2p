package com.ems.dispatch.service

import com.ems.dispatch.entity.*
import com.ems.dispatch.repository.HospitalRepository
import com.ems.dispatch.repository.NotificationRepository
import com.ems.dispatch.repository.UserRepository
import com.ems.dispatch.util.EventNoGenerator
import com.ems.dispatch.util.GisUtils
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.client.RestTemplate
import java.time.LocalDateTime

@Service
class NotificationService(
    private val notificationRepository: NotificationRepository,
    private val userRepository: UserRepository,
    private val hospitalRepository: HospitalRepository,
    private val eventNoGenerator: EventNoGenerator,
    private val messagingTemplate: SimpMessagingTemplate,
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    @Value("\${ems.notification.sms-gateway-url}")
    private val smsGatewayUrl: String
) {
    private val logger = LoggerFactory.getLogger(NotificationService::class.java)
    private val restTemplate = RestTemplate()

    data class HospitalPreNotification(
        val eventId: Long,
        val eventNo: String,
        val patientName: String,
        val patientGender: String?,
        val patientAge: Int?,
        val chiefComplaint: String,
        val conditionSeverity: String,
        val vitalSigns: Map<String, Any>?,
        val preliminaryDiagnosis: String?,
        val treatmentMeasures: List<Map<String, Any>>?,
        val currentLocation: com.ems.dispatch.dto.LocationDto,
        val etaMinutes: Int,
        val hospitalName: String
    )

    @Transactional
    fun createDispatchNotification(event: DispatchEvent, ambulance: Ambulance) {
        val notificationNo = eventNoGenerator.generateNotificationNo()

        val notification = Notification(
            notificationNo = notificationNo,
            type = Notification.NotificationType.NEW_DISPATCH.name,
            priority = Notification.Priority.URGENT.name,
            title = "新派车任务: ${event.eventNo}",
            content = "患者: ${event.patientName ?: "未知"}, 地址: ${event.emergencyAddress}",
            dispatchEvent = event,
            channel = Notification.Channel.WEBSOCKET.name,
            status = Notification.Status.PENDING.name
        )

        val savedNotification = notificationRepository.save(notification)
        sendWebSocketNotification(savedNotification)

        ambulance.driverPhone?.let { phone ->
            sendSms(phone, "急救中心派车通知: 请前往${event.emergencyAddress}")
        }

        event.doctor?.let { doctor ->
            sendUserNotification(doctor, notification)
        }
    }

    @Transactional
    fun sendHospitalPreNotification(event: DispatchEvent) {
        if (event.hospital == null) {
            logger.warn("Cannot send hospital notification: no hospital assigned to event ${event.eventNo}")
            return
        }

        val hospital = event.hospital!!
        val medicalRecord = event.medicalRecord

        val preNotification = HospitalPreNotification(
            eventId = event.id!!,
            eventNo = event.eventNo,
            patientName = event.patientName ?: "未知",
            patientGender = event.patientGender,
            patientAge = event.patientAge,
            chiefComplaint = event.chiefComplaint,
            conditionSeverity = event.conditionSeverity,
            vitalSigns = medicalRecord?.vitalSigns,
            preliminaryDiagnosis = medicalRecord?.preliminaryDiagnosis,
            treatmentMeasures = medicalRecord?.treatmentMeasures,
            currentLocation = GisUtils.toLocationDto(event.emergencyLocation)!!,
            etaMinutes = event.estimatedArrivalMinutes ?: 15,
            hospitalName = hospital.name
        )

        val notificationNo = eventNoGenerator.generateNotificationNo()
        val notification = Notification(
            notificationNo = notificationNo,
            type = Notification.NotificationType.HOSPITAL_NOTIFICATION.name,
            priority = Notification.Priority.HIGH.name,
            title = "患者预通知: ${event.eventNo}",
            content = "患者 ${preNotification.patientName} 即将送达，预计 ${preNotification.etaMinutes} 分钟",
            dispatchEvent = event,
            recipientHospital = hospital,
            channel = Notification.Channel.WEBSOCKET.name,
            status = Notification.Status.PENDING.name
        )

        notificationRepository.save(notification)

        messagingTemplate.convertAndSend(
            "/topic/hospital/${hospital.id}/pre-notification",
            preNotification
        )

        logger.info("Pre-notification sent to hospital ${hospital.name} for event ${event.eventNo}")

        kafkaTemplate.send("ems.notification", "HOSPITAL_PRE_NOTIFICATION", preNotification)
    }

    @Transactional
    fun sendUserNotification(user: User, notification: Notification) {
        val userNotification = notification.copy(
            notificationNo = eventNoGenerator.generateNotificationNo(),
            recipientUser = user
        )
        notificationRepository.save(userNotification)

        messagingTemplate.convertAndSendToUser(
            user.username,
            "/queue/notifications",
            toDto(userNotification)
        )
    }

    fun sendWebSocketNotification(notification: Notification) {
        messagingTemplate.convertAndSend("/topic/notifications", toDto(notification))
        updateNotificationStatus(notification, Notification.Status.SENT)
    }

    fun sendSms(phoneNumber: String, message: String): Boolean {
        return try {
            val payload = mapOf(
                "phone" to phoneNumber,
                "message" to message
            )
            val response = restTemplate.postForObject(smsGatewayUrl, payload, String::class.java)
            logger.info("SMS sent to $phoneNumber: $response")
            true
        } catch (e: Exception) {
            logger.error("Failed to send SMS to $phoneNumber", e)
            false
        }
    }

    @Transactional
    fun acknowledgeHospitalNotification(notificationId: Long): Boolean {
        val notification = notificationRepository.findById(notificationId)
            .orElseThrow { IllegalArgumentException("Notification not found: $notificationId") }

        notification.ackReceived = true
        notification.ackAt = LocalDateTime.now()
        notification.status = Notification.Status.ACKNOWLEDGED.name

        notificationRepository.save(notification)
        logger.info("Notification $notificationId acknowledged by hospital")

        return true
    }

    @Transactional(readOnly = true)
    fun getUserNotifications(userId: Long): List<NotificationDto> {
        val notifications = notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(userId)
        return notifications.map { toDto(it) }
    }

    @Transactional(readOnly = true)
    fun getUnreadCount(userId: Long): Long {
        return notificationRepository.countUnreadByUserId(userId)
    }

    @Transactional
    fun markAsRead(notificationId: Long): Boolean {
        val notification = notificationRepository.findById(notificationId)
            .orElseThrow { IllegalArgumentException("Notification not found: $notificationId") }

        notification.readAt = LocalDateTime.now()
        notification.status = Notification.Status.READ.name
        notificationRepository.save(notification)

        return true
    }

    @Transactional
    fun createAlert(type: String, title: String, content: String, priority: String) {
        val notificationNo = eventNoGenerator.generateNotificationNo()

        val notification = Notification(
            notificationNo = notificationNo,
            type = type,
            priority = priority,
            title = title,
            content = content,
            channel = Notification.Channel.WEBSOCKET.name,
            status = Notification.Status.PENDING.name
        )

        notificationRepository.save(notification)
        sendWebSocketNotification(notification)
    }

    @KafkaListener(topics = ["ems.notification"], groupId = "ems-dispatch-notification")
    fun handleNotificationKafkaMessage(message: Map<String, Any>) {
        logger.debug("Received notification kafka message: ${message["type"]}")
    }

    @Transactional
    fun updateNotificationStatus(notification: Notification, status: Notification.Status) {
        notification.status = status.name
        if (status == Notification.Status.SENT) {
            notification.sentAt = LocalDateTime.now()
        }
        notificationRepository.save(notification)
    }

    data class NotificationDto(
        val id: Long,
        val notificationNo: String,
        val type: String,
        val priority: String,
        val title: String,
        val content: String?,
        val dispatchEventId: Long?,
        val status: String,
        val createdAt: LocalDateTime,
        val readAt: LocalDateTime?
    )

    private fun toDto(notification: Notification): NotificationDto {
        return NotificationDto(
            id = notification.id!!,
            notificationNo = notification.notificationNo,
            type = notification.type,
            priority = notification.priority,
            title = notification.title,
            content = notification.content,
            dispatchEventId = notification.dispatchEvent?.id,
            status = notification.status,
            createdAt = notification.createdAt,
            readAt = notification.readAt
        )
    }
}
