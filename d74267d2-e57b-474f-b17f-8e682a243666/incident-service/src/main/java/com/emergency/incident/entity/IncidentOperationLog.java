package com.emergency.incident.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("incident_operation_log")
public class IncidentOperationLog extends BaseEntity {

    private Long incidentId;

    private String operationType;

    private String operationDetail;

    private String beforeStatus;

    private String afterStatus;

    private String operatorName;

    private Long operatorId;

    private Long operatorOrgId;

    private LocalDateTime operationTime;

    private String remark;
}
