package com.tobacco.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "稽查违规统计数据")
public class InspectionStatistics {

    @Schema(description = "稽查任务总数")
    private Long totalTasks;

    @Schema(description = "已完成任务数")
    private Long completedTasks;

    @Schema(description = "违规记录总数")
    private Long totalViolations;

    @Schema(description = "违规率")
    private BigDecimal violationRate;

    @Schema(description = "各违规类型分布")
    private Map<String, Long> byViolationType;

    @Schema(description = "各严重程度分布")
    private Map<String, Long> bySeverity;

    @Schema(description = "各县区违规数")
    private Map<String, Long> byCounty;

    @Schema(description = "各稽查员任务数")
    private Map<String, Long> byInspector;

    @Schema(description = "月度违规趋势")
    private Map<String, Long> trendByMonth;
}
