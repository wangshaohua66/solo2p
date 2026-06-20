package com.tvstation.media.service;

import com.tvstation.media.dto.NotificationMessage;

public interface NotificationService {

    void sendNotification(NotificationMessage message);

    void sendWebSocketNotification(Long userId, String title, String content);

    void sendEmailNotification(Long userId, String subject, String body);

    void sendSmsNotification(Long userId, String content);

    void broadcastNotification(String title, String content);

    void sendReviewTimeoutNotification(Long reviewItemId, String title, Long reviewerId, Integer level);
}
