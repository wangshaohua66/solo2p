package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "查勘派工请求")
public class SurveyAssignRequest {

    @Schema(description = "理赔案件ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "1001")
    @NotNull(message = "理赔案件ID不能为空")
    private Long claimId;

    @Schema(description = "查勘员ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "2001")
    @NotNull(message = "查勘员ID不能为空")
    private Long surveyorId;

    @Schema(description = "派工备注", example = "请尽快前往现场查勘")
    private String remark;
}
