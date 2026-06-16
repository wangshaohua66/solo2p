package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "疲劳风险报告")
public class FatigueReportVO {

    private Long crewId;
    private String crewName;
    private Double currentFatigueScore;
    private Double weeklyDutyHours;
    private Double monthlyDutyHours;
    private Integer consecutiveDutyDays;
    private Integer timezoneCrossings;
    private String alertLevel;
    private Boolean isLocked;
}
