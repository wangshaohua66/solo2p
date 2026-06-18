package com.insurance.claim.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
@Schema(description = "赔款计算明细响应")
public class CompensationDetailResponse {

    @Schema(description = "理赔案件ID", example = "1001")
    private Long claimId;

    @Schema(description = "案件编号", example = "CL2024011500001")
    private String claimNo;

    @Schema(description = "保单号", example = "POL2024010100001")
    private String policyNo;

    @Schema(description = "险种名称", example = "车险")
    private String insuranceTypeName;

    @Schema(description = "总损失金额", example = "10000.00")
    private BigDecimal totalLossAmount;

    @Schema(description = "责任比例(%)", example = "70")
    private Integer liabilityRatio;

    @Schema(description = "责任分摊后金额", example = "7000.00")
    private BigDecimal liabilityAmount;

    @Schema(description = "绝对免赔额", example = "200.00")
    private BigDecimal deductibleAmount;

    @Schema(description = "相对免赔率(%)", example = "5")
    private BigDecimal deductibleRatio;

    @Schema(description = "免赔额金额", example = "350.00")
    private BigDecimal deductibleRatioAmount;

    @Schema(description = "实际免赔金额(取较大值)", example = "350.00")
    private BigDecimal actualDeductible;

    @Schema(description = "历史事故次数", example = "1")
    private Integer accidentCount;

    @Schema(description = "浮动系数", example = "1.1")
    private BigDecimal floatingCoefficient;

    @Schema(description = "浮动调整金额", example = "700.00")
    private BigDecimal floatingAdjustmentAmount;

    @Schema(description = "残值扣除", example = "200.00")
    private BigDecimal salvageValue;

    @Schema(description = "其他调整金额", example = "0.00")
    private BigDecimal otherAdjustment;

    @Schema(description = "保险金额", example = "200000.00")
    private BigDecimal coverageAmount;

    @Schema(description = "计算后赔付金额(不含限额)", example = "6150.00")
    private BigDecimal calculatedAmount;

    @Schema(description = "最高赔付限额", example = "200000.00")
    private BigDecimal maxPaymentLimit;

    @Schema(description = "最终应赔付金额", example = "6150.00")
    private BigDecimal finalPayableAmount;

    @Schema(description = "计算公式说明")
    private String calculationFormula;

    @Schema(description = "计算明细项")
    private List<CalculationItem> calculationItems;

    @Schema(description = "计算时间")
    private String calculationTime;

    @Data
    @Schema(description = "计算明细项")
    public static class CalculationItem {
        @Schema(description = "项目名称", example = "前保险杠")
        private String itemName;

        @Schema(description = "项目类型", example = "配件")
        private String itemType;

        @Schema(description = "损失金额", example = "1500.00")
        private BigDecimal lossAmount;

        @Schema(description = "责任分摊", example = "1050.00")
        private BigDecimal liabilityShare;

        @Schema(description = "赔付金额", example = "1050.00")
        private BigDecimal payableAmount;

        @Schema(description = "备注", example = "按70%责任比例计算")
        private String remark;
    }
}
