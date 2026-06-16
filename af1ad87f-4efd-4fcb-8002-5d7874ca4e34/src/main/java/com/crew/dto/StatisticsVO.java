package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.Map;

@Data
@Schema(description = "统计报表数据")
public class StatisticsVO {

    private String period;
    private Double avgUtilizationRate;
    private Integer totalViolations;
    private Double avgFatigueScore;
    private Integer highFatigueCount;
    private Map<String, Integer> violationsByType;
    private Map<String, Double> fatigueDistribution;
    private Map<String, Integer> manpowerGap;
}
