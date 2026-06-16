package com.emergency.incident.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import com.emergency.common.enums.IncidentLevel;
import com.emergency.common.enums.IncidentType;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("incident_response_plan")
public class ResponsePlan extends BaseEntity {

    private String planCode;

    private String planName;

    private IncidentType incidentType;

    private IncidentLevel minLevel;

    private IncidentLevel maxLevel;

    private String description;

    private String responseProcedure;

    private String requiredResources;

    private String responsibleDept;

    private String contactInfo;

    private Integer estimatedDuration;

    private Integer priority;

    private Integer status;

    private String rulesConfig;
}
