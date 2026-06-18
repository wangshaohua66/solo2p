package com.wedding.suite.service;

import com.wedding.suite.entity.NotificationEntity;
import com.wedding.suite.enums.NotificationType;

import java.util.List;

public interface NotificationService {
    void push(Long userId, String title, String content, NotificationType type, String bizType, Long bizId);

    default void push(Long userId, String title, String content, NotificationType type) {
        push(userId, title, content, type, null, null);
    }

    void broadcast(String title, String content, NotificationType type);

    List<NotificationEntity> listMine(Long userId);

    long unreadCount(Long userId);

    void markRead(Long id);

    void markAllRead(Long userId);
}
