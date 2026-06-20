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
@Schema(description = "订货统计数据")
public class OrderStatistics {

    @Schema(description = "订单总数")
    private Long totalOrders;

    @Schema(description = "总订货量（条）")
    private Long totalQuantity;

    @Schema(description = "总订货金额（元）")
    private BigDecimal totalAmount;

    @Schema(description = "户均订货量（条）")
    private BigDecimal avgQuantityPerRetailer;

    @Schema(description = "订货履约率")
    private BigDecimal fulfillmentRate;

    @Schema(description = "超配额拦截订单数")
    private Long quotaExceededCount;

    @Schema(description = "各周期订货量趋势")
    private Map<String, Long> trendByPeriod;

    @Schema(description = "各县区订货量")
    private Map<String, Long> byCounty;

    @Schema(description = "各品牌订货量")
    private Map<String, Long> byBrand;

    @Schema(description = "各档位订货量")
    private Map<Integer, Long> byTier;
}
