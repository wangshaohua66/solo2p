package com.emergency.incident.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.dto.GeoPoint;
import com.emergency.common.entity.BaseEntity;
import com.emergency.common.enums.IncidentType;
import com.emergency.incident.handler.GeoPointTypeHandler;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "incident_data_source", autoResultMap = true)
public class IncidentDataSource extends BaseEntity {

    private Long incidentId;

    private String dataType;

    private String source;

    private String dataContent;

    private String rawData;

    @TableField(typeHandler = GeoPointTypeHandler.class)
    private GeoPoint dataPoint;

    private String dataQuality;

    private Double confidence;

    private LocalDateTime collectedAt;

    private String collectedBy;
}
