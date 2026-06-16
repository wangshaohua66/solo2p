package com.emergency.notification.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import com.emergency.common.enums.NotificationChannel;
import com.emergency.common.enums.NotificationStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("notification_receipt")
public class NotificationReceipt extends BaseEntity {

    private Long notificationId;

    private Long recipientId;

    private String recipientName;

    private String recipientPhone;

    private NotificationChannel channel;

    private String messageId;

    private NotificationStatus status;

    private LocalDateTime sentAt;

    private LocalDateTime deliveredAt;

    private LocalDateTime readAt;

    private String failureReason;

    private String deviceInfo;

    private String ipAddress;

    private String location;

    private String remark;
}
