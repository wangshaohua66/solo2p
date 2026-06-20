package com.tvstation.media.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationMessage {

    private Long userId;

    private String title;

    private String content;

    private NotificationType type;

    private String channel;

    private Map<String, Object> extra;

    private LocalDateTime createdAt;

    public enum NotificationType {
        REVIEW_TIMEOUT,
        COPYRIGHT_EXPIRING,
        COPYRIGHT_RISK,
        REVIEW_ASSIGNED,
        TASK_DUE,
        SYSTEM
    }

    public enum Channel {
        WEBSOCKET,
        EMAIL,
        SMS,
        ALL
    }
}
