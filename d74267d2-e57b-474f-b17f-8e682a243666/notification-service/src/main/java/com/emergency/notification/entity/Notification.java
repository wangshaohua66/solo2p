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
@TableName("notification")
public class Notification extends BaseEntity {

    private String notificationNo;

    private Long incidentId;

    private Long dispatchPlanId;

    private String title;

    private String content;

    private String summary;

    private NotificationChannel channel;

    private String targetType;

    private String targetIds;

    private Integer targetCount;

    private Integer successCount;

    private Integer failCount;

    private Integer readCount;

    private NotificationStatus status;

    private Integer priority;

    private String regionCode;

    private Integer incidentLevel;

    private LocalDateTime scheduledAt;

    private LocalDateTime sentAt;

    private LocalDateTime expiredAt;

    private String templateCode;

    private String templateParams;

    private String failureReason;

    private String callbackUrl;

    private String remark;
}
