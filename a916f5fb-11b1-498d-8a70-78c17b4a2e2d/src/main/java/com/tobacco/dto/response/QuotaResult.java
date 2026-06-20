package com.tobacco.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "配额计算结果")
public class QuotaResult {

    @Schema(description = "零售户ID")
    private Long retailerId;

    @Schema(description = "零售户名称")
    private String retailerName;

    @Schema(description = "档位（1-30）")
    private Integer tier;

    @Schema(description = "信用等级")
    private String creditLevel;

    @Schema(description = "档位基准量")
    private Integer baseQuota;

    @Schema(description = "信用系数")
    private BigDecimal creditCoefficient;

    @Schema(description = "销量波动因子")
    private BigDecimal salesFactor;

    @Schema(description = "本期配额上限（条）")
    private Integer quotaLimit;

    @Schema(description = "已用配额（条）")
    private Integer quotaUsed;

    @Schema(description = "剩余配额（条）")
    private Integer quotaRemaining;

    @Schema(description = "订货周期")
    private String orderPeriod;

    @Schema(description = "本期超配额尝试次数")
    private Integer quotaExceededCount;
}
