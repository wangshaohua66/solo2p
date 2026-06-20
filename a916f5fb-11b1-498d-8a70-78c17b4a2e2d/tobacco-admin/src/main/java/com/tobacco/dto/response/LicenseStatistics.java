package com.tobacco.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "许可证统计数据")
public class LicenseStatistics {

    @Schema(description = "总许可证数")
    private Long totalCount;

    @Schema(description = "正常营业数")
    private Long activeCount;

    @Schema(description = "停业数")
    private Long suspendedCount;

    @Schema(description = "注销数")
    private Long cancelledCount;

    @Schema(description = "待审批数")
    private Long pendingCount;

    @Schema(description = "本月新增数")
    private Long newThisMonth;

    @Schema(description = "即将到期数（30天内）")
    private Long expiringSoon;

    @Schema(description = "各业态分布")
    private Map<String, Long> byBusinessType;

    @Schema(description = "各县区分布")
    private Map<String, Long> byCounty;

    @Schema(description = "各档位分布")
    private Map<Integer, Long> byTier;
}
