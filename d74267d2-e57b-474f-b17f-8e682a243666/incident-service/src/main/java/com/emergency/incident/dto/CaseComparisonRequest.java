package com.emergency.incident.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "案例对比请求")
public class CaseComparisonRequest {

    @Schema(description = "源灾情ID", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "源灾情ID不能为空")
    private Long sourceIncidentId;

    @Schema(description = "目标案例ID", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "目标案例ID不能为空")
    private Long targetCaseId;

    @Schema(description = "对比指标列表")
    private java.util.List<String> comparisonMetrics;
}
