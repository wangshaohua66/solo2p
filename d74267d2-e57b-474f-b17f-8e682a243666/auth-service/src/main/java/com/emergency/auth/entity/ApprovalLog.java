package com.emergency.auth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import com.emergency.common.enums.ApprovalStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_approval_log")
public class ApprovalLog extends BaseEntity {

    private Long approvalId;

    private Long approverId;

    private String approverName;

    private Long approverOrgId;

    private Integer approvalLevel;

    private ApprovalStatus action;

    private String opinion;

    private LocalDateTime actionTime;
}
