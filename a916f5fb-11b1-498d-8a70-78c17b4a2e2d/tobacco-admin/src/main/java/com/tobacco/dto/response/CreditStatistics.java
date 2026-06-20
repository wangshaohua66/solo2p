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
@Schema(description = "信用统计数据")
public class CreditStatistics {

    @Schema(description = "总零售户数")
    private Long totalRetailers;

    @Schema(description = "平均信用分")
    private BigDecimal avgScore;

    @Schema(description = "各信用等级分布")
    private Map<String, Long> byLevel;

    @Schema(description = "信用变更总次数")
    private Long totalChanges;

    @Schema(description = "扣分次数")
    private Long deductCount;

    @Schema(description = "加分次数")
    private Long bonusCount;

    @Schema(description = "修复次数")
    private Long repairCount;

    @Schema(description = "各县区平均信用分")
    private Map<String, BigDecimal> avgScoreByCounty;

    @Schema(description = "信用降级数")
    private Long downgradeCount;

    @Schema(description = "信用升级数")
    private Long upgradeCount;
}
