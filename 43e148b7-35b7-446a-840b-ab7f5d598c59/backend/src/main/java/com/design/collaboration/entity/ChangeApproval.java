package com.design.collaboration.entity;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "变更审批记录")
public class ChangeApproval {

    @Schema(description = "审批ID")
    private Long id;

    @Schema(description = "变更申请ID")
    private Long changeRequestId;

    @Schema(description = "审批人ID")
    private Long approverId;

    @Schema(description = "审批人姓名")
    private transient String approverName;

    @Schema(description = "审批人角色")
    private String approverRole;

    @Schema(description = "审批意见")
    private String comment;

    @Schema(description = "是否通过")
    private Boolean approved;

    @Schema(description = "审批时间")
    private LocalDateTime approvedAt;
}
