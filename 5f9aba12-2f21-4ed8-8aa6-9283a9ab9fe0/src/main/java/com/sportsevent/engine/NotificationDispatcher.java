package com.sportsevent.engine;

import com.sportsevent.entity.Notification;
import com.sportsevent.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationDispatcher {

    private final NotificationRepository notificationRepository;

    @Value("${event.notification.retry-count:3}")
    private int maxRetryCount;

    @Value("${event.notification.retry-interval-seconds:60}")
    private int retryIntervalSeconds;

    @Async
    public CompletableFuture<DispatchResult> dispatch(Notification notification) {
        DispatchResult result = new DispatchResult();
        result.setNotificationId(notification.getId());
        result.setTotalRecipients(notification.getRecipients() != null ? notification.getRecipients().size() : 0);

        log.info("Dispatching notification [{}] type={}, channel={}",
                notification.getId(), notification.getType(), notification.getChannel());

        try {
            if (notification.getRecipients() == null || notification.getRecipients().isEmpty()) {
                notification.setStatus(Notification.NotificationStatus.FAILED);
                notification.setSentAt(LocalDateTime.now());
                notificationRepository.save(notification);

                result.setSuccess(false);
                result.setMessage("No recipients specified");
                return CompletableFuture.completedFuture(result);
            }

            notification.setStatus(Notification.NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());

            List<Notification.Recipient> updatedRecipients = new ArrayList<>();
            int deliveredCount = 0;
            int failedCount = 0;

            for (Notification.Recipient recipient : notification.getRecipients()) {
                DeliveryResult deliveryResult = deliverToRecipient(notification, recipient);
                Notification.Recipient updated = new Notification.Recipient();
                updated.setRecipientId(recipient.getRecipientId());
                updated.setRecipientType(recipient.getRecipientType());
                updated.setName(recipient.getName());
                updated.setContact(recipient.getContact());

                if (deliveryResult.success) {
                    updated.setIndividualStatus(Notification.NotificationStatus.DELIVERED);
                    updated.setDeliveredAt(LocalDateTime.now());
                    deliveredCount++;
                } else {
                    updated.setIndividualStatus(Notification.NotificationStatus.FAILED);
                    failedCount++;
                }

                updatedRecipients.add(updated);
            }

            notification.setRecipients(updatedRecipients);

            if (deliveredCount == updatedRecipients.size()) {
                notification.setStatus(Notification.NotificationStatus.DELIVERED);
            } else if (deliveredCount > 0) {
                notification.setStatus(Notification.NotificationStatus.SENT);
            } else {
                notification.setStatus(Notification.NotificationStatus.FAILED);
            }

            notificationRepository.save(notification);

            result.setSuccess(failedCount == 0);
            result.setDeliveredCount(deliveredCount);
            result.setFailedCount(failedCount);
            result.setMessage(String.format("Dispatched: %d delivered, %d failed", deliveredCount, failedCount));

            log.info("Notification [{}] dispatched: {}/{} delivered",
                    notification.getId(), deliveredCount, result.getTotalRecipients());

        } catch (Exception e) {
            log.error("Error dispatching notification [{}]: {}", notification.getId(), e.getMessage(), e);

            notification.setStatus(Notification.NotificationStatus.FAILED);
            notification.setRetryCount(notification.getRetryCount() + 1);
            notificationRepository.save(notification);

            result.setSuccess(false);
            result.setMessage("Dispatch failed: " + e.getMessage());
        }

        return CompletableFuture.completedFuture(result);
    }

    private DeliveryResult deliverToRecipient(Notification notification, Notification.Recipient recipient) {
        DeliveryResult result = new DeliveryResult();

        try {
            switch (notification.getChannel()) {
                case IN_APP:
                    result = deliverInApp(notification, recipient);
                    break;
                case WECHAT_TEMPLATE:
                    result = deliverWechatTemplate(notification, recipient);
                    break;
                case SMS:
                    result = deliverSms(notification, recipient);
                    break;
                case EMAIL:
                    result = deliverEmail(notification, recipient);
                    break;
                default:
                    result.success = true;
                    result.message = "Channel simulated";
            }
        } catch (Exception e) {
            result.success = false;
            result.message = e.getMessage();
        }

        return result;
    }

    private DeliveryResult deliverInApp(Notification notification, Notification.Recipient recipient) {
        DeliveryResult result = new DeliveryResult();
        result.success = true;
        result.message = "In-app message delivered to user: " + recipient.getRecipientId();
        log.debug("In-app notification to {}: {}", recipient.getRecipientId(), notification.getTitle());
        return result;
    }

    private DeliveryResult deliverWechatTemplate(Notification notification, Notification.Recipient recipient) {
        DeliveryResult result = new DeliveryResult();
        result.success = true;
        result.message = "WeChat template message simulated for: " + recipient.getName();
        log.debug("WeChat notification to {} ({})", recipient.getName(), recipient.getContact());
        return result;
    }

    private DeliveryResult deliverSms(Notification notification, Notification.Recipient recipient) {
        DeliveryResult result = new DeliveryResult();
        if (recipient.getContact() == null || recipient.getContact().isEmpty()) {
            result.success = false;
            result.message = "No phone number available";
            return result;
        }
        result.success = true;
        result.message = "SMS simulated for: " + recipient.getContact();
        log.debug("SMS notification to {}: {}", recipient.getContact(), notification.getTitle());
        return result;
    }

    private DeliveryResult deliverEmail(Notification notification, Notification.Recipient recipient) {
        DeliveryResult result = new DeliveryResult();
        if (recipient.getContact() == null || recipient.getContact().isEmpty()) {
            result.success = false;
            result.message = "No email address available";
            return result;
        }
        result.success = true;
        result.message = "Email simulated for: " + recipient.getContact();
        log.debug("Email notification to {}: {}", recipient.getContact(), notification.getTitle());
        return result;
    }

    public Notification createNotification(Notification.NotificationType type, String title, String content,
                                            String relatedEntityId, String relatedEntityType,
                                            Notification.NotificationChannel channel,
                                            List<Notification.Recipient> recipients) {
        Notification notification = new Notification();
        notification.setType(type);
        notification.setTitle(title);
        notification.setContent(content);
        notification.setRelatedEntityId(relatedEntityId);
        notification.setRelatedEntityType(relatedEntityType);
        notification.setChannel(channel);
        notification.setRecipients(recipients);
        notification.setStatus(Notification.NotificationStatus.PENDING);
        notification.setRetryCount(0);
        notification.setScheduledAt(LocalDateTime.now());
        notification.setCreatedAt(LocalDateTime.now());
        notification.setUpdatedAt(LocalDateTime.now());

        return notificationRepository.save(notification);
    }

    @Async
    public void retryFailedNotifications() {
        List<Notification> pending = notificationRepository.findPendingNotifications(LocalDateTime.now());

        log.info("Found {} pending/failed notifications to retry", pending.size());

        for (Notification notification : pending) {
            if (notification.getRetryCount() < maxRetryCount) {
                dispatch(notification);
            }
        }
    }

    @lombok.Data
    public static class DispatchResult {
        private String notificationId;
        private boolean success;
        private String message;
        private int totalRecipients;
        private int deliveredCount;
        private int failedCount;
    }

    private static class DeliveryResult {
        boolean success;
        String message;
    }
}
