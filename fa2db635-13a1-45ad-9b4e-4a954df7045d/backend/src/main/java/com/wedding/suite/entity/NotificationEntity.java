package com.wedding.suite.entity;

import com.wedding.suite.enums.NotificationType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NotificationEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id")
    private Long userId;
    @Column(nullable = false, length = 128)
    private String title;
    @Column(length = 512)
    private String content;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private NotificationType type;
    @Column(name = "biz_type", length = 32)
    private String bizType;
    @Column(name = "biz_id")
    private Long bizId;
    @Column(name = "read_flag", nullable = false)
    private Boolean readFlag;
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
