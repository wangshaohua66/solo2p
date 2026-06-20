package com.design.collaboration.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "审批请求")
public class ApprovalRequest {

    @NotNull(message = "审批意见不能为空")
    @Schema(description = "是否通过", required = true)
    private Boolean approved;

    @Schema(description = "审批备注")
    private String comment;
}
