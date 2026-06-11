package com.glassstudio.service;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    public void sendToTopic(String topic, Object payload) {
        messagingTemplate.convertAndSend(topic, payload);
    }

    public void sendTemperatureAlert(Long kilnId, String message) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("kilnId", kilnId);
        payload.put("message", message);
        payload.put("type", "TEMPERATURE_ALERT");
        payload.put("timestamp", System.currentTimeMillis());
        sendToTopic("/topic/alert", payload);
    }

    public void sendScheduleUpdate(Long scheduleId, String status, String message) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("scheduleId", scheduleId);
        payload.put("status", status);
        payload.put("message", message);
        payload.put("type", "SCHEDULE_UPDATE");
        payload.put("timestamp", System.currentTimeMillis());
        sendToTopic("/topic/schedule/update", payload);
    }

    public void sendPersonalNotification(Long userId, String title, String content) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);
        payload.put("title", title);
        payload.put("content", content);
        payload.put("type", "PERSONAL_NOTIFICATION");
        payload.put("timestamp", System.currentTimeMillis());
        messagingTemplate.convertAndSendToUser(String.valueOf(userId), "/queue/notifications", payload);
    }

    public void sendInventoryAlert(String message) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("message", message);
        payload.put("type", "INVENTORY_ALERT");
        payload.put("timestamp", System.currentTimeMillis());
        sendToTopic("/topic/alert", payload);
    }
}
