package com.emergency.incident.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "生成复盘报告请求")
public class GenerateReviewRequest {

    @Schema(description = "灾情ID", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "灾情ID不能为空")
    private Long incidentId;

    @Schema(description = "归档ID", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "归档ID不能为空")
    private Long archiveId;

    @Schema(description = "报告标题", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "报告标题不能为空")
    private String title;

    @Schema(description = "报告类型")
    private String reportType;

    @Schema(description = "存在的问题")
    private String existingProblems;

    @Schema(description = "改进措施")
    private String improvementMeasures;

    @Schema(description = "经验教训")
    private String lessonsLearned;
}
