package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
@Schema(description = "排班生成请求")
public class RosterGenerateRequest {

    @NotNull(message = "排班月份不能为空")
    @Schema(description = "排班月份", example = "2026-07")
    private LocalDate month;

    @Schema(description = "是否包含红眼航班", example = "true")
    private Boolean includeRedEye = true;

    @Schema(description = "优化目标: BALANCED/MIN_FATIGUE/MAX_UTILIZATION", example = "BALANCED")
    private String optimizeGoal = "BALANCED";

    @Schema(description = "生成方案数量", example = "3")
    private Integer planCount = 3;
}
