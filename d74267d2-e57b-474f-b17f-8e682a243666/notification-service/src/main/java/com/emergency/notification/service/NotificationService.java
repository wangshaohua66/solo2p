package com.emergency.notification.service;

import com.emergency.notification.dto.NotificationSendRequest;
import com.emergency.notification.entity.Notification;
import com.emergency.notification.entity.NotificationReceipt;

import java.util.List;

public interface NotificationService {

    Long sendNotification(NotificationSendRequest request);

    Long sendIncidentAlert(Long incidentId);

    List<Long> broadcastNotification(String title, String content, String regionCode, Integer incidentLevel);

    Notification getNotificationById(Long id);

    Notification getNotificationByNo(String notificationNo);

    List<Notification> getNotificationsByIncidentId(Long incidentId);

    List<NotificationReceipt> getReceiptsByNotificationId(Long notificationId);

    List<NotificationReceipt> getReceiptsByRecipientId(Long recipientId);

    boolean confirmReceipt(Long receiptId);

    void processPendingNotifications();

    void checkAndUpdateStatus(Long notificationId);

    List<Notification> getUserNotifications(Long userId, int pageNum, int pageSize);
}
