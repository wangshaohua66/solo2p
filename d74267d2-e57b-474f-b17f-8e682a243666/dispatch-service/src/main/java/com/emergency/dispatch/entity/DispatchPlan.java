package com.emergency.dispatch.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import com.emergency.common.enums.DispatchStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dispatch_plan")
public class DispatchPlan extends BaseEntity {

    private String dispatchNo;

    private Long incidentId;

    private String incidentNo;

    private String title;

    private DispatchStatus status;

    private Integer priority;

    private Integer requiredLevel;

    private BigDecimal estimatedDistance;

    private Integer estimatedDuration;

    private LocalDateTime estimatedArrivalTime;

    private String dispatchStrategy;

    private String taskDescription;

    private String dangerWarning;

    private Long currentApprovalId;

    private Long createdByOrgId;

    private String remark;
}
