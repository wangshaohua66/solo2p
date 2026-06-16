package com.emergency.incident.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import com.emergency.incident.handler.GeoPointTypeHandler;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.locationtech.jts.geom.Point;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("incident_history_case")
public class IncidentHistoryCase extends BaseEntity {

    private String caseNo;

    private Long incidentId;

    private Long reportId;

    private String caseTitle;

    private String caseType;

    private Integer incidentType;

    private Integer incidentLevel;

    private String regionCode;

    private String location;

    @TableField(typeHandler = GeoPointTypeHandler.class)
    private Point locationPoint;

    private LocalDateTime occurredAt;

    private LocalDateTime endedAt;

    private BigDecimal durationHours;

    private String description;

    private String keyMeasures;

    private String mainExperiences;

    private String lessonsLearned;

    private String responseEfficiency;

    private String resourceAllocation;

    private Integer affectedPopulation;

    private Integer casualtyCount;

    private BigDecimal directLoss;

    private Integer overallRating;

    private String tags;

    private Boolean isClassic;

    private Integer status;
}
