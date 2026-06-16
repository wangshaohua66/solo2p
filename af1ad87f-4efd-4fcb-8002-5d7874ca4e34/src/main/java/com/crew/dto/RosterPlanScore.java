package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "排班方案评分明细")
public class RosterPlanScore {

    @Schema(description = "综合评分 0-100，越高越好")
    private double compositeScore;

    @Schema(description = "利用率得分 0-30")
    private double utilizationScore;

    @Schema(description = "合规性得分 0-30")
    private double complianceScore;

    @Schema(description = "疲劳控制得分 0-25")
    private double fatigueScore;

    @Schema(description = "均衡性得分 0-15")
    private double balanceScore;

    @Schema(description = "优化目标")
    private String optimizeGoal;

    @Schema(description = "机组利用率 %")
    private double utilizationRate;

    @Schema(description = "违规数")
    private int violationCount;

    @Schema(description = "平均疲劳指数")
    private double avgFatigue;

    @Schema(description = "工时标准差（衡量均衡性）")
    private double hourStdDev;
}
