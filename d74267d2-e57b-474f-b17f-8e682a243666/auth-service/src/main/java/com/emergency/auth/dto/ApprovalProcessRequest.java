package com.emergency.auth.dto;

import com.emergency.common.enums.ApprovalStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;

@Data
@Schema(description = "审批处理请求")
public class ApprovalProcessRequest implements Serializable {

    @Schema(description = "审批ID")
    @NotNull(message = "审批ID不能为空")
    private Long approvalId;

    @Schema(description = "审批状态:1-通过 2-拒绝")
    @NotNull(message = "审批状态不能为空")
    private ApprovalStatus status;

    @Schema(description = "审批意见")
    @NotBlank(message = "审批意见不能为空")
    private String opinion;
}
