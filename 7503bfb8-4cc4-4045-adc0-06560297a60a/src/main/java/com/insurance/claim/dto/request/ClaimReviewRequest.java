package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Schema(description = "核赔审核请求")
public class ClaimReviewRequest {

    @Schema(description = "理赔案件ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "1001")
    @NotNull(message = "理赔案件ID不能为空")
    private Long claimId;

    @Schema(description = "核赔师ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "4001")
    @NotNull(message = "核赔师ID不能为空")
    private Long reviewerId;

    @Schema(description = "审核级别 1-一级审核 2-二级审核 3-三级审核", requiredMode = Schema.RequiredMode.REQUIRED, example = "1")
    @NotNull(message = "审核级别不能为空")
    private Integer reviewLevel;

    @Schema(description = "审核类型 auto-自动审核 manual-人工审核", requiredMode = Schema.RequiredMode.REQUIRED, example = "manual")
    @NotBlank(message = "审核类型不能为空")
    @Size(max = 20, message = "审核类型长度不能超过20字符")
    private String reviewType;

    @Schema(description = "报案定损金额", example = "8000.00")
    private BigDecimal claimAmount;

    @Schema(description = "审核后金额", example = "7800.00")
    private BigDecimal reviewedAmount;

    @Schema(description = "审核结果 1-通过 2-驳回 3-需补充材料", requiredMode = Schema.RequiredMode.REQUIRED, example = "1")
    @NotNull(message = "审核结果不能为空")
    private Integer reviewResult;

    @Schema(description = "审核意见", example = "材料齐全，定损合理，同意赔付")
    @Size(max = 500, message = "审核意见长度不能超过500字符")
    private String reviewComments;

    @Schema(description = "驳回原因", example = "缺少维修发票")
    @Size(max = 500, message = "驳回原因长度不能超过500字符")
    private String rejectReason;

    @Schema(description = "需补充材料说明", example = "请提供维修发票和费用明细")
    @Size(max = 500, message = "需补充材料说明长度不能超过500字符")
    private String supplementRequirements;

    @Schema(description = "备注", example = "无")
    @Size(max = 500, message = "备注长度不能超过500字符")
    private String remark;
}
