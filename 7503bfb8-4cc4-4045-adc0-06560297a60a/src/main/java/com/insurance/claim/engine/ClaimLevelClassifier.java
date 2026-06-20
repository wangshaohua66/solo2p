package com.insurance.claim.engine;

import com.insurance.claim.entity.Claim;
import com.insurance.claim.entity.LossAssessment;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Slf4j
@Component
public class ClaimLevelClassifier {

    @Value("${claim.level.small-amount:5000}")
    private BigDecimal smallAmountThreshold;

    @Value("${claim.level.medium-amount:50000}")
    private BigDecimal mediumAmountThreshold;

    @Value("${claim.level.small-auto-review:true}")
    private boolean smallCaseAutoReview;

    @Value("${claim.level.small-max-fraud-score:30}")
    private int smallCaseMaxFraudScore;

    public ClassificationResult classify(Claim claim, LossAssessment assessment) {
        ClassificationResult result = new ClassificationResult();
        result.setClaimId(claim.getId());
        result.setClaimNo(claim.getClaimNo());
        result.setClassifiedAt(LocalDateTime.now());

        BigDecimal amount = assessment != null && assessment.getTotalLossAmount() != null
                ? assessment.getTotalLossAmount()
                : (claim.getEstimatedAmount() != null ? claim.getEstimatedAmount() : BigDecimal.ZERO);
        result.setClaimAmount(amount);

        if (amount.compareTo(smallAmountThreshold) <= 0) {
            result.setLevel(ClaimLevel.SMALL);
            result.setLevelName("小额案件");
            result.setNeedManualReview(false);
            result.setAutoReviewEligible(smallCaseAutoReview
                    && (claim.getFraudScore() == null || claim.getFraudScore() <= smallCaseMaxFraudScore)
                    && !Boolean.TRUE.equals(claim.getFraudSuspicious()));
            result.setReviewLevel(1);
        } else if (amount.compareTo(mediumAmountThreshold) <= 0) {
            result.setLevel(ClaimLevel.MEDIUM);
            result.setLevelName("中额案件");
            result.setNeedManualReview(true);
            result.setAutoReviewEligible(false);
            result.setReviewLevel(1);
        } else {
            result.setLevel(ClaimLevel.LARGE);
            result.setLevelName("大额案件");
            result.setNeedManualReview(true);
            result.setAutoReviewEligible(false);
            result.setReviewLevel(2);

            if (amount.compareTo(new BigDecimal("200000")) > 0) {
                result.setReviewLevel(3);
                result.setLevelName("重大案件");
            }
        }

        log.info("案件分级完成: {}, 金额={}, 等级={}, 审核级别={}, 自动审核={}",
                claim.getClaimNo(), amount, result.getLevelName(),
                result.getReviewLevel(), result.isAutoReviewEligible());

        return result;
    }

    public boolean isSmallCase(BigDecimal amount) {
        return amount != null && amount.compareTo(smallAmountThreshold) <= 0;
    }

    public AutoReviewResult performAutoReview(Claim claim, LossAssessment assessment) {
        AutoReviewResult result = new AutoReviewResult();
        result.setClaimId(claim.getId());
        result.setClaimNo(claim.getClaimNo());
        result.setReviewedAt(LocalDateTime.now());

        ClassificationResult classification = classify(claim, assessment);
        if (!classification.isAutoReviewEligible()) {
            result.setPassed(false);
            result.setReason("不满足自动审核条件");
            result.setMessage("转入人工审核");
            log.info("案件{}不满足自动审核条件: {}", claim.getClaimNo(), result.getReason());
            return result;
        }

        boolean valid = true;
        StringBuilder reasons = new StringBuilder();

        if (claim.getLiabilityRatio() != null && claim.getLiabilityRatio() < 100) {
            valid = false;
            reasons.append("多方责任需人工确认；");
        }

        if (Boolean.TRUE.equals(claim.getFraudSuspicious())
                || (claim.getFraudScore() != null && claim.getFraudScore() > smallCaseMaxFraudScore)) {
            valid = false;
            reasons.append("存在欺诈风险；");
        }

        if (assessment != null && Boolean.TRUE.equals(assessment.getExceedStandard())) {
            valid = false;
            reasons.append("定损超标需人工确认；");
        }

        result.setPassed(valid);
        result.setReviewType("AUTO");
        result.setReviewerId(0L);
        result.setReviewerName("系统自动审核");
        result.setReviewLevel(1);

        if (valid) {
            result.setComments("小额案件快速通道审核通过");
            result.setMessage("自动审核通过");
            log.info("案件{}自动审核通过", claim.getClaimNo());
        } else {
            result.setReason(reasons.toString());
            result.setMessage("自动审核未通过: " + reasons);
            log.info("案件{}自动审核未通过: {}", claim.getClaimNo(), reasons);
        }

        return result;
    }

    public enum ClaimLevel {
        SMALL, MEDIUM, LARGE
    }

    @Data
    public static class ClassificationResult {
        private Long claimId;
        private String claimNo;
        private ClaimLevel level;
        private String levelName;
        private Integer reviewLevel;
        private BigDecimal claimAmount;
        private boolean needManualReview;
        private boolean autoReviewEligible;
        private LocalDateTime classifiedAt;
    }

    @Data
    public static class AutoReviewResult {
        private Long claimId;
        private String claimNo;
        private boolean passed;
        private String reviewType;
        private Long reviewerId;
        private String reviewerName;
        private Integer reviewLevel;
        private String comments;
        private String reason;
        private String message;
        private LocalDateTime reviewedAt;
    }
}
