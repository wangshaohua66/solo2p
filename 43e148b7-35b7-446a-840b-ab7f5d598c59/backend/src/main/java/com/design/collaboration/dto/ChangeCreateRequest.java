package com.design.collaboration.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Schema(description = "创建变更请求")
public class ChangeCreateRequest {

    @NotNull(message = "项目ID不能为空")
    @Schema(description = "项目ID", required = true)
    private Long projectId;

    @NotBlank(message = "变更标题不能为空")
    @Schema(description = "变更标题", required = true)
    private String title;

    @NotBlank(message = "变更原因不能为空")
    @Schema(description = "变更原因", required = true)
    private String reason;

    @NotBlank(message = "变更内容不能为空")
    @Schema(description = "变更内容", required = true)
    private String content;

    @Schema(description = "影响范围")
    private String impactScope;

    @Schema(description = "变更工作量（人天）")
    private Integer workload;

    @Schema(description = "追加费用")
    private BigDecimal additionalFee;

    @Schema(description = "申请人类型：INTERNAL/CLIENT")
    private String applicantType = "INTERNAL";
}
