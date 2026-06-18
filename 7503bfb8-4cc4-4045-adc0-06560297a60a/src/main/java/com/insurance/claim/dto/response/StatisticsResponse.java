package com.insurance.claim.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
@Schema(description = "统计分析响应")
public class StatisticsResponse {

    @Schema(description = "统计维度 month-月度 quarter-季度 year-年度 insurance-险种 branch-机构", example = "month")
    private String dimension;

    @Schema(description = "统计开始时间", example = "2024-01-01")
    private String startDate;

    @Schema(description = "统计结束时间", example = "2024-12-31")
    private String endDate;

    @Schema(description = "总案件数", example = "150000")
    private Long totalClaimCount;

    @Schema(description = "已结案数", example = "145000")
    private Long closedClaimCount;

    @Schema(description = "结案率(%)", example = "96.67")
    private BigDecimal closureRate;

    @Schema(description = "总赔付金额", example = "125000000.00")
    private BigDecimal totalPaymentAmount;

    @Schema(description = "平均赔付金额", example = "8333.33")
    private BigDecimal averagePaymentAmount;

    @Schema(description = "平均结案周期(天)", example = "5.2")
    private BigDecimal averageSettlementDays;

    @Schema(description = "在途案件数", example = "5000")
    private Long pendingClaimCount;

    @Schema(description = "注销案件数", example = "2000")
    private Long cancelledClaimCount;

    @Schema(description = "可疑欺诈案件数", example = "300")
    private Long fraudSuspiciousCount;

    @Schema(description = "险种统计")
    private List<InsuranceStatistics> insuranceStatistics;

    @Schema(description = "机构统计")
    private List<BranchStatistics> branchStatistics;

    @Schema(description = "月度趋势")
    private List<MonthlyTrend> monthlyTrends;

    @Data
    @Schema(description = "险种统计")
    public static class InsuranceStatistics {
        @Schema(description = "险种代码", example = "1")
        private Integer insuranceType;

        @Schema(description = "险种名称", example = "车险")
        private String insuranceTypeName;

        @Schema(description = "案件数", example = "120000")
        private Long claimCount;

        @Schema(description = "赔付金额", example = "100000000.00")
        private BigDecimal paymentAmount;

        @Schema(description = "赔付率(%)", example = "65.5")
        private BigDecimal lossRatio;

        @Schema(description = "平均赔付金额", example = "8333.33")
        private BigDecimal averagePayment;
    }

    @Data
    @Schema(description = "机构统计")
    public static class BranchStatistics {
        @Schema(description = "机构编码", example = "BRANCH001")
        private String branchCode;

        @Schema(description = "机构名称", example = "北京分公司")
        private String branchName;

        @Schema(description = "案件数", example = "50000")
        private Long claimCount;

        @Schema(description = "赔付金额", example = "45000000.00")
        private BigDecimal paymentAmount;

        @Schema(description = "赔付率(%)", example = "62.3")
        private BigDecimal lossRatio;

        @Schema(description = "结案率(%)", example = "97.5")
        private BigDecimal closureRate;
    }

    @Data
    @Schema(description = "月度趋势")
    public static class MonthlyTrend {
        @Schema(description = "月份", example = "2024-01")
        private String month;

        @Schema(description = "案件数", example = "12500")
        private Long claimCount;

        @Schema(description = "赔付金额", example = "10500000.00")
        private BigDecimal paymentAmount;

        @Schema(description = "赔付率(%)", example = "63.2")
        private BigDecimal lossRatio;

        @Schema(description = "结案率(%)", example = "96.8")
        private BigDecimal closureRate;
    }
}
