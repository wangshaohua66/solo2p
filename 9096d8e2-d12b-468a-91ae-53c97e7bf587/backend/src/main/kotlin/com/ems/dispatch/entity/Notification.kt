package com.ems.dispatch.entity

import jakarta.persistence.*
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.LocalDateTime

@Entity
@Table(name = "notifications")
@EntityListeners(AuditingEntityListener::class)
data class Notification(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(name = "notification_no", nullable = false, unique = true, length = 50)
    var notificationNo: String,

    @Column(nullable = false, length = 30)
    var type: String,

    @Column(nullable = false, length = 20)
    var priority: String = "NORMAL",

    @Column(nullable = false, length = 200)
    var title: String,

    @Column(columnDefinition = "TEXT")
    var content: String? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dispatch_event_id")
    var dispatchEvent: DispatchEvent? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_user_id")
    var recipientUser: User? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_hospital_id")
    var recipientHospital: Hospital? = null,

    @Column(nullable = false, length = 30)
    var channel: String = "WEBSOCKET",

    @Column(nullable = false, length = 20)
    var status: String = "PENDING",

    @Column(name = "sent_at")
    var sentAt: LocalDateTime? = null,

    @Column(name = "read_at")
    var readAt: LocalDateTime? = null,

    @Column(name = "ack_received")
    var ackReceived: Boolean = false,

    @Column(name = "ack_at")
    var ackAt: LocalDateTime? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now()
) {
    enum class NotificationType {
        NEW_DISPATCH, DISPATCH_UPDATE, VEHICLE_ALERT, MEDICAL_RECORD_SUBMITTED,
        QC_REVIEW_REQUIRED, HOSPITAL_NOTIFICATION, MAINTENANCE_ALERT,
        SUPPLY_LOW_ALERT, SYSTEM_ALERT, USER_NOTIFICATION
    }

    enum class Priority {
        LOW, NORMAL, HIGH, URGENT, EMERGENCY
    }

    enum class Channel {
        WEBSOCKET, SMS, EMAIL, APP_PUSH, IN_APP
    }

    enum class Status {
        PENDING, SENDING, SENT, DELIVERED, READ, FAILED, ACKNOWLEDGED
    }
}
