package com.insurance.claim.service;

import com.insurance.claim.dto.response.CompensationDetailResponse;
import com.insurance.claim.entity.Claim;
import com.insurance.claim.entity.LossAssessment;
import com.insurance.claim.entity.LossItem;
import com.insurance.claim.entity.Policy;
import com.insurance.claim.mapper.LossAssessmentMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompensationCalculationEngine {

    private final PolicyService policyService;
    private final LossAssessmentMapper lossAssessmentMapper;

    @Value("${claim.calculation.min-deductible:200}")
    private BigDecimal minDeductible;

    @Value("${claim.calculation.max-floating-coefficient:1.5}")
    private BigDecimal maxFloatingCoefficient;

    public CompensationDetailResponse calculateCompensation(Long claimId) {
        log.info("开始赔款计算: 案件{}", claimId);
        long startTime = System.currentTimeMillis();

        Claim claim = getClaimFromContext(claimId);
        Policy policy = policyService.getPolicyByNo(claim.getPolicyNo());
        LossAssessment assessment = lossAssessmentMapper.selectByClaimId(claimId);
        List<LossItem> lossItems = lossAssessmentMapper.selectLossItemsByAssessmentId(assessment.getId());

        CompensationDetailResponse response = new CompensationDetailResponse();
        response.setClaimId(claimId);
        response.setClaimNo(claim.getClaimNo());
        response.setPolicyNo(claim.getPolicyNo());
        response.setInsuranceTypeName(policy.getInsuranceType().getName());

        BigDecimal totalLossAmount = assessment.getTotalLossAmount() != null
                ? assessment.getTotalLossAmount() : BigDecimal.ZERO;
        response.setTotalLossAmount(totalLossAmount);

        Integer liabilityRatio = claim.getLiabilityRatio() != null ? claim.getLiabilityRatio() : 100;
        response.setLiabilityRatio(liabilityRatio);

        BigDecimal liabilityAmount = totalLossAmount
                .multiply(BigDecimal.valueOf(liabilityRatio))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        response.setLiabilityAmount(liabilityAmount);

        BigDecimal deductibleAmount = policy.getDeductible() != null ? policy.getDeductible() : BigDecimal.ZERO;
        if (deductibleAmount.compareTo(BigDecimal.ZERO) > 0 && deductibleAmount.compareTo(minDeductible) < 0) {
            deductibleAmount = minDeductible;
        }
        response.setDeductibleAmount(deductibleAmount);

        BigDecimal deductibleRatio = policy.getDeductibleRatio() != null
                ? policy.getDeductibleRatio() : BigDecimal.ZERO;
        response.setDeductibleRatio(deductibleRatio);

        BigDecimal deductibleRatioAmount = liabilityAmount
                .multiply(deductibleRatio)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        response.setDeductibleRatioAmount(deductibleRatioAmount);

        BigDecimal actualDeductible = deductibleAmount.max(deductibleRatioAmount);
        response.setActualDeductible(actualDeductible);

        int accidentCount = claim.getAccidentCount() != null ? claim.getAccidentCount() : 0;
        response.setAccidentCount(accidentCount);

        BigDecimal floatingCoefficient = calculateFloatingCoefficient(accidentCount);
        response.setFloatingCoefficient(floatingCoefficient);

        BigDecimal floatingAdjustmentAmount = liabilityAmount
                .multiply(floatingCoefficient.subtract(BigDecimal.ONE))
                .setScale(2, RoundingMode.HALF_UP);
        response.setFloatingAdjustmentAmount(floatingAdjustmentAmount);

        BigDecimal salvageValue = assessment.getSalvageValue() != null
                ? assessment.getSalvageValue() : BigDecimal.ZERO;
        response.setSalvageValue(salvageValue);

        BigDecimal otherAdjustment = BigDecimal.ZERO;
        response.setOtherAdjustment(otherAdjustment);

        BigDecimal coverageAmount = policy.getTotalCoverage() != null
                ? policy.getTotalCoverage() : new BigDecimal("99999999.99");
        response.setCoverageAmount(coverageAmount);

        BigDecimal calculatedAmount = liabilityAmount
                .subtract(actualDeductible)
                .add(floatingAdjustmentAmount)
                .subtract(salvageValue)
                .add(otherAdjustment);
        if (calculatedAmount.compareTo(BigDecimal.ZERO) < 0) {
            calculatedAmount = BigDecimal.ZERO;
        }
        response.setCalculatedAmount(calculatedAmount);

        BigDecimal maxPaymentLimit = coverageAmount;
        response.setMaxPaymentLimit(maxPaymentLimit);

        BigDecimal finalPayableAmount = calculatedAmount.min(maxPaymentLimit);
        if (finalPayableAmount.compareTo(BigDecimal.ZERO) < 0) {
            finalPayableAmount = BigDecimal.ZERO;
        }
        response.setFinalPayableAmount(finalPayableAmount);

        String formula = String.format(
                "赔款 = (总损失 × 责任比例%s - 免赔额%s - 残值%s) × 浮动系数%s，最高不超过保额%s",
                liabilityRatio + "%",
                actualDeductible,
                salvageValue,
                floatingCoefficient,
                coverageAmount
        );
        response.setCalculationFormula(formula);
        response.setCalculationTime(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        List<CompensationDetailResponse.CalculationItem> calculationItems = buildCalculationItems(lossItems, liabilityRatio);
        response.setCalculationItems(calculationItems);

        long endTime = System.currentTimeMillis();
        log.info("赔款计算完成: 案件{}, 总损失={}, 应赔付={}, 耗时={}ms",
                claimId, totalLossAmount, finalPayableAmount, (endTime - startTime));

        return response;
    }

    private BigDecimal calculateFloatingCoefficient(int accidentCount) {
        BigDecimal coefficient;

        switch (accidentCount) {
            case 0:
                coefficient = new BigDecimal("0.9");
                break;
            case 1:
                coefficient = BigDecimal.ONE;
                break;
            case 2:
                coefficient = new BigDecimal("1.1");
                break;
            case 3:
                coefficient = new BigDecimal("1.2");
                break;
            case 4:
                coefficient = new BigDecimal("1.3");
                break;
            case 5:
                coefficient = new BigDecimal("1.4");
                break;
            default:
                coefficient = maxFloatingCoefficient;
                break;
        }

        log.debug("浮动系数计算: 事故次数={}, 系数={}", accidentCount, coefficient);
        return coefficient;
    }

    private List<CompensationDetailResponse.CalculationItem> buildCalculationItems(
            List<LossItem> lossItems, Integer liabilityRatio) {

        List<CompensationDetailResponse.CalculationItem> items = new ArrayList<>();

        for (LossItem lossItem : lossItems) {
            CompensationDetailResponse.CalculationItem item = new CompensationDetailResponse.CalculationItem();
            item.setItemName(lossItem.getItemName());
            item.setItemType(getItemTypeName(lossItem.getItemType()));
            item.setLossAmount(lossItem.getTotalAmount());

            BigDecimal liabilityShare = lossItem.getTotalAmount()
                    .multiply(BigDecimal.valueOf(liabilityRatio))
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            item.setLiabilityShare(liabilityShare);
            item.setPayableAmount(liabilityShare);
            item.setRemark("按" + liabilityRatio + "%责任比例计算");

            items.add(item);
        }

        return items;
    }

    private String getItemTypeName(Integer itemType) {
        if (itemType == null) {
            return "其他";
        }
        return switch (itemType) {
            case 1 -> "配件";
            case 2 -> "工时";
            case 3 -> "材料";
            default -> "其他";
        };
    }

    private Claim getClaimFromContext(Long claimId) {
        throw new UnsupportedOperationException("请通过ClaimService调用赔款计算");
    }

    public BigDecimal calculatePayableAmount(Claim claim, Policy policy, LossAssessment assessment) {
        BigDecimal totalLossAmount = assessment.getTotalLossAmount() != null
                ? assessment.getTotalLossAmount() : BigDecimal.ZERO;

        Integer liabilityRatio = claim.getLiabilityRatio() != null ? claim.getLiabilityRatio() : 100;
        BigDecimal liabilityAmount = totalLossAmount
                .multiply(BigDecimal.valueOf(liabilityRatio))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        BigDecimal deductibleAmount = policy.getDeductible() != null ? policy.getDeductible() : BigDecimal.ZERO;
        if (deductibleAmount.compareTo(BigDecimal.ZERO) > 0 && deductibleAmount.compareTo(minDeductible) < 0) {
            deductibleAmount = minDeductible;
        }

        BigDecimal deductibleRatio = policy.getDeductibleRatio() != null
                ? policy.getDeductibleRatio() : BigDecimal.ZERO;
        BigDecimal deductibleRatioAmount = liabilityAmount
                .multiply(deductibleRatio)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        BigDecimal actualDeductible = deductibleAmount.max(deductibleRatioAmount);

        int accidentCount = claim.getAccidentCount() != null ? claim.getAccidentCount() : 0;
        BigDecimal floatingCoefficient = calculateFloatingCoefficient(accidentCount);
        BigDecimal floatingAdjustmentAmount = liabilityAmount
                .multiply(floatingCoefficient.subtract(BigDecimal.ONE))
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal salvageValue = assessment.getSalvageValue() != null
                ? assessment.getSalvageValue() : BigDecimal.ZERO;

        BigDecimal calculatedAmount = liabilityAmount
                .subtract(actualDeductible)
                .add(floatingAdjustmentAmount)
                .subtract(salvageValue);

        if (calculatedAmount.compareTo(BigDecimal.ZERO) < 0) {
            calculatedAmount = BigDecimal.ZERO;
        }

        BigDecimal coverageAmount = policy.getTotalCoverage() != null
                ? policy.getTotalCoverage() : new BigDecimal("99999999.99");

        return calculatedAmount.min(coverageAmount);
    }
}
