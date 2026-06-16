package com.emergency.notification.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import com.emergency.common.enums.IncidentType;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("notification_template")
public class NotificationTemplate extends BaseEntity {

    private String templateCode;

    private String templateName;

    private IncidentType incidentType;

    private Integer minIncidentLevel;

    private String titleTemplate;

    private String contentTemplate;

    private String channel;

    private String targetRules;

    private Integer priority;

    private String variables;

    private Integer status;

    private String remark;
}
