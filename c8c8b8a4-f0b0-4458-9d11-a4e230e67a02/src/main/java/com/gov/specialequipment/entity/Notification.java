package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("notification")
public class Notification extends BaseEntity {

    private String notificationType;

    private String title;

    private String content;

    private Long receiverId;

    private String receiverName;

    private String receiverRole;

    private Integer readStatus;

    private LocalDateTime readTime;

    private String bizType;

    private Long bizId;

    private String remark;
}
