package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "notifications")
public class Notification {

    @Id
    private String id;

    private NotificationType type;

    private String title;

    private String content;

    private String relatedEntityId;

    private String relatedEntityType;

    private List<Recipient> recipients;

    private NotificationChannel channel;

    private NotificationStatus status;

    private Integer retryCount;

    private LocalDateTime scheduledAt;

    private LocalDateTime sentAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum NotificationType {
        SCHEDULE_CHANGE, VENUE_CHANGE, SCORE_PUBLISHED, REGISTRATION_RESULT,
        MATCH_REMINDER, REFEREE_ASSIGNMENT, LEAGUE_ANNOUNCEMENT, APPEAL_RESULT
    }

    public enum NotificationChannel {
        IN_APP, WECHAT_TEMPLATE, SMS, EMAIL
    }

    public enum NotificationStatus {
        PENDING, SENT, FAILED, DELIVERED, READ
    }

    @Data
    public static class Recipient {
        private String recipientId;
        private RecipientType recipientType;
        private String name;
        private String contact;
        private NotificationStatus individualStatus;
        private LocalDateTime deliveredAt;

        public enum RecipientType {
            ATHLETE, TEAM, REFEREE, COORDINATOR, VENUE_MANAGER
        }
    }
}
