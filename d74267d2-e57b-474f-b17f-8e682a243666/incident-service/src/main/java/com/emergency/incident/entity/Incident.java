package com.emergency.incident.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.dto.GeoPoint;
import com.emergency.common.entity.BaseEntity;
import com.emergency.common.enums.IncidentLevel;
import com.emergency.common.enums.IncidentStatus;
import com.emergency.common.enums.IncidentType;
import com.emergency.incident.handler.GeoPointTypeHandler;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "incident_event", autoResultMap = true)
public class Incident extends BaseEntity {

    private String incidentNo;

    private IncidentType type;

    private IncidentLevel level;

    private IncidentStatus status;

    private String title;

    private String description;

    private String location;

    @TableField(typeHandler = GeoPointTypeHandler.class)
    private GeoPoint locationPoint;

    private String regionCode;

    private Long organizationId;

    private BigDecimal affectedArea;

    private Integer affectedPopulation;

    private BigDecimal estimatedLoss;

    private Integer casualties;

    private Integer injured;

    private Integer missing;

    private Integer trapped;

    private String sourceType;

    private String sourceDetail;

    private String weatherCondition;

    private String terrainCondition;

    private LocalDateTime occurredAt;

    private LocalDateTime reportedAt;

    private LocalDateTime respondedAt;

    private LocalDateTime controlledAt;

    private LocalDateTime closedAt;

    private String responsePlanId;

    private String remarks;

    @TableField(exist = false)
    private String levelColor;

    public String getLevelColor() {
        return level != null ? level.getColor() : null;
    }
}
