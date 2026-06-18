package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
@Schema(description = "定损提交请求")
public class LossAssessmentRequest {

    @Schema(description = "理赔案件ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "1001")
    @NotNull(message = "理赔案件ID不能为空")
    private Long claimId;

    @Schema(description = "定损员ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "3001")
    @NotNull(message = "定损员ID不能为空")
    private Long assessorId;

    @Schema(description = "责任比例(%)", requiredMode = Schema.RequiredMode.REQUIRED, example = "70")
    @NotNull(message = "责任比例不能为空")
    private Integer liabilityRatio;

    @Schema(description = "残值金额", example = "200.00")
    private BigDecimal salvageValue;

    @Schema(description = "定损意见", example = "按照配件指导价定损，建议更换前保险杠")
    @Size(max = 500, message = "定损意见长度不能超过500字符")
    private String assessmentComments;

    @Schema(description = "损失项目列表", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotEmpty(message = "损失项目不能为空")
    private List<LossItemRequest> lossItems;

    @Schema(description = "备注", example = "无")
    @Size(max = 500, message = "备注长度不能超过500字符")
    private String remark;
}
