package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Schema(description = "查勘派工请求")
public class SurveyAssignRequest {

    @Schema(description = "理赔案件ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "1001")
    @NotNull(message = "理赔案件ID不能为空")
    private Long claimId;

    @Schema(description = "查勘员ID(手动指定时传，智能分配模式不传)", example = "2001")
    private Long surveyorId;

    @Schema(description = "派工模式: auto-智能分配 manual-手动指定", example = "auto")
    private String assignMode = "auto";

    @Schema(description = "事故经度(智能分配必填)", example = "116.404")
    private BigDecimal longitude;

    @Schema(description = "事故纬度(智能分配必填)", example = "39.915")
    private BigDecimal latitude;

    @Schema(description = "搜索半径(米)，默认5000", example = "5000")
    private Integer searchRadius = 5000;

    @Schema(description = "派工备注", example = "请尽快前往现场查勘")
    private String remark;
}
