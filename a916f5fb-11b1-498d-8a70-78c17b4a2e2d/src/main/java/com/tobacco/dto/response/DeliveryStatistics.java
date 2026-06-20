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
@Schema(description = "配送统计数据")
public class DeliveryStatistics {

    @Schema(description = "配送计划总数")
    private Long totalPlans;

    @Schema(description = "配送订单总数")
    private Long totalOrders;

    @Schema(description = "配送总件数")
    private Long totalQuantity;

    @Schema(description = "平均装载率（%）")
    private BigDecimal avgLoadRate;

    @Schema(description = "空载率（%）")
    private BigDecimal emptyLoadRate;

    @Schema(description = "平均配送里程（公里）")
    private BigDecimal avgDistance;

    @Schema(description = "各车队配送量")
    private Map<Integer, Long> byFleet;

    @Schema(description = "各县区配送量")
    private Map<String, Long> byCounty;

    @Schema(description = "各周期配送量趋势")
    private Map<String, Long> trendByPeriod;

    @Schema(description = "平均计算耗时（秒）")
    private BigDecimal avgCalcTime;
}
