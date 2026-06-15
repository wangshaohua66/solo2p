package com.ems.dispatch.repository

import com.ems.dispatch.entity.Notification
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface NotificationRepository : JpaRepository<Notification, Long> {
    fun findByNotificationNo(notificationNo: String): Notification?
    fun findByRecipientUserIdOrderByCreatedAtDesc(recipientUserId: Long): List<Notification>
    fun findByRecipientHospitalIdOrderByCreatedAtDesc(recipientHospitalId: Long): List<Notification>
    fun findByStatus(status: String): List<Notification>
    fun findByDispatchEventId(dispatchEventId: Long): List<Notification>

    @Query(
        """
        SELECT n FROM Notification n 
        WHERE n.recipientUser.id = :userId 
        AND n.status IN :statuses 
        ORDER BY n.createdAt DESC
        """
    )
    fun findByUserIdAndStatuses(
        @Param("userId") userId: Long,
        @Param("statuses") statuses: List<String>
    ): List<Notification>

    @Query(
        """
        SELECT COUNT(n) FROM Notification n 
        WHERE n.recipientUser.id = :userId 
        AND n.status = 'DELIVERED'
        AND n.readAt IS NULL
        """
    )
    fun countUnreadByUserId(@Param("userId") userId: Long): Long

    fun deleteByCreatedAtBefore(timestamp: LocalDateTime)
}
