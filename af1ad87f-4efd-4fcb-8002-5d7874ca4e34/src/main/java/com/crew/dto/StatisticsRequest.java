package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "统计报表请求")
public class StatisticsRequest {

    @Schema(description = "统计类型: MONTHLY/QUARTERLY/YEARLY", example = "MONTHLY")
    private String periodType = "MONTHLY";

    @Schema(description = "开始月份", example = "2026-01")
    private String startPeriod;

    @Schema(description = "结束月份", example = "2026-06")
    private String endPeriod;

    @Schema(description = "维度: AIRCRAFT/ROUTE/CREW/BASE", example = "BASE")
    private String dimension;

    @Schema(description = "维度值（如机型代码、基地代码）")
    private String dimensionValue;
}
