package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.Map;

@Data
@Schema(description = "维度下钻统计结果")
public class DrillDownVO {

    @Schema(description = "统计周期")
    private String period;

    @Schema(description = "维度类型: AIRCRAFT/ROUTE/CREW/BASE")
    private String dimension;

    @Schema(description = "维度值（如机型B737、基地PEK、航线PEK-SHA、人员张三）")
    private String dimensionValue;

    @Schema(description = "机组利用率 %")
    private Double utilizationRate;

    @Schema(description = "累计执勤小时数")
    private Double totalDutyHours;

    @Schema(description = "排班任务数")
    private Integer assignmentCount;

    @Schema(description = "违规次数")
    private Integer violationCount;

    @Schema(description = "平均疲劳指数")
    private Double avgFatigueScore;

    @Schema(description = "高疲劳任务数(>70)")
    private Integer highFatigueCount;

    @Schema(description = "参与机组人员数")
    private Integer crewCount;

    @Schema(description = "按子维度分布（如机型下钻时按机组人员分布）")
    private Map<String, Object> subDistribution;
}
