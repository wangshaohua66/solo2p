package com.insurance.claim.service;

import com.insurance.claim.entity.Claim;
import com.insurance.claim.entity.Policy;
import com.insurance.claim.entity.Survey;
import com.insurance.claim.mapper.ClaimRepository;
import com.insurance.claim.mapper.PolicyMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class RiskAssessmentEngine {

    @Value("${claim.fraud.high-frequency-days:30}")
    private Integer highFrequencyDays;

    @Value("${claim.fraud.high-frequency-count:3}")
    private Integer highFrequencyCount;

    @Value("${claim.fraud.excess-claim-ratio:1.5}")
    private BigDecimal excessClaimRatio;

    @Value("${claim.fraud.suspicious-score-threshold:70}")
    private Integer suspiciousScoreThreshold;

    private final ClaimRepository claimMapper;
    private final PolicyMapper policyMapper;

    public RiskAssessmentResult assessClaimRisk(Claim claim, Policy policy) {
        long startTime = System.currentTimeMillis();
        List<RiskFactor> riskFactors = new ArrayList<>();
        int totalScore = 0;

        riskFactors.add(assessClaimFrequency(claim));
        riskFactors.add(assessClaimAmount(claim, policy));
        riskFactors.add(assessPolicyAge(policy));
        riskFactors.add(assessTimeFactors(claim));
        riskFactors.add(assessGeographicFactors(claim));
        riskFactors.add(assessHistoricalClaims(claim));

        for (RiskFactor factor : riskFactors) {
            totalScore += factor.getScore();
        }

        boolean suspicious = totalScore >= suspiciousScoreThreshold;
        String flags = buildFraudFlags(riskFactors);

        long endTime = System.currentTimeMillis();
        log.info("风控评估完成: 案件={}, 风险得分={}, 是否可疑={}, 耗时={}ms",
                claim.getClaimNo(), totalScore, suspicious, (endTime - startTime));

        return new RiskAssessmentResult(totalScore, suspicious, flags, riskFactors);
    }

    private RiskFactor assessClaimFrequency(Claim claim) {
        RiskFactor factor = new RiskFactor("claim_frequency", "报案频率", 0, "正常");

        if (claim.getReporterIdCard() != null) {
            int recentClaims = claimRepository.countClaimsByIdCardAndDays(
                    claim.getReporterIdCard(), highFrequencyDays);

            if (recentClaims >= highFrequencyCount * 2) {
                factor.setScore(30);
                factor.setDescription(String.format("%d天内报案%d次，远超正常水平", highFrequencyDays, recentClaims));
            } else if (recentClaims >= highFrequencyCount) {
                factor.setScore(15);
                factor.setDescription(String.format("%d天内报案%d次，频率较高", highFrequencyDays, recentClaims));
            }
        }

        return factor;
    }

    private RiskFactor assessClaimAmount(Claim claim, Policy policy) {
        RiskFactor factor = new RiskFactor("claim_amount", "索赔金额", 0, "正常");

        if (claim.getEstimatedAmount() != null && policy.getTotalCoverage() != null
                && policy.getTotalCoverage().compareTo(BigDecimal.ZERO) > 0) {

            BigDecimal ratio = claim.getEstimatedAmount()
                    .divide(policy.getTotalCoverage(), 4, BigDecimal.ROUND_HALF_UP);

            if (ratio.compareTo(excessClaimRatio) > 0) {
                factor.setScore(25);
                factor.setDescription("索赔金额相对保额过高，存在超额索赔风险");
            } else if (ratio.compareTo(BigDecimal.valueOf(0.8)) > 0) {
                factor.setScore(10);
                factor.setDescription("索赔金额接近保额，需重点关注");
            }
        }

        return factor;
    }

    private RiskFactor assessPolicyAge(Policy policy) {
        RiskFactor factor = new RiskFactor("policy_age", "保单投保时长", 0, "正常");

        if (policy.getEffectiveDate() != null) {
            long days = java.time.temporal.ChronoUnit.DAYS.between(
                    policy.getEffectiveDate(), java.time.LocalDate.now());

            if (days < 7) {
                factor.setScore(20);
                factor.setDescription("投保未满一周即报案，存在先险后保风险");
            } else if (days < 30) {
                factor.setScore(10);
                factor.setDescription("投保未满一月即报案，需关注");
            }
        }

        return factor;
    }

    private RiskFactor assessTimeFactors(Claim claim) {
        RiskFactor factor = new RiskFactor("time_factor", "时间因素", 0, "正常");

        if (claim.getAccidentTime() != null) {
            int hour = claim.getAccidentTime().getHour();

            if (hour >= 2 && hour < 5) {
                factor.setScore(10);
                factor.setDescription("事故发生在凌晨时段，存在可疑");
            }

            int dayOfWeek = claim.getAccidentTime().getDayOfWeek().getValue();
            if (dayOfWeek == 6 || dayOfWeek == 7) {
                factor.setScore(factor.getScore() + 5);
                factor.setDescription(factor.getDescription() + "；周末报案");
            }
        }

        return factor;
    }

    private RiskFactor assessGeographicFactors(Claim claim) {
        RiskFactor factor = new RiskFactor("geographic", "地理因素", 0, "正常");

        if (claim.getAccidentProvince() != null && claim.getAccidentCity() != null) {
            String area = claim.getAccidentProvince() + claim.getAccidentCity();
            if (isHighFraudArea(area)) {
                factor.setScore(10);
                factor.setDescription("事故发生在欺诈高发区域");
            }
        }

        return factor;
    }

    private RiskFactor assessHistoricalClaims(Claim claim) {
        RiskFactor factor = new RiskFactor("historical", "历史理赔", 0, "正常");

        if (claim.getPolicyNo() != null) {
            Policy policy = policyMapper.selectByPolicyNo(claim.getPolicyNo());
            int historicalCount = policy != null && policy.getClaimCount() != null ? policy.getClaimCount() : 0;

            if (historicalCount >= 5) {
                factor.setScore(20);
                factor.setDescription(String.format("保单历史理赔%d次，出险过于频繁", historicalCount));
            } else if (historicalCount >= 3) {
                factor.setScore(10);
                factor.setDescription(String.format("保单历史理赔%d次，出险较频繁", historicalCount));
            }
        }

        return factor;
    }

    public RiskAssessmentResult assessSurveyRisk(Survey survey, Claim claim) {
        List<RiskFactor> riskFactors = new ArrayList<>();
        int totalScore = 0;

        if (survey.getGpsVerified() != null && !survey.getGpsVerified()) {
            riskFactors.add(new RiskFactor("gps_unverified", "GPS校验未通过", 30, "查勘员GPS定位异常，可能存在虚假查勘"));
            totalScore += 30;
        }

        if (survey.getEstimatedLossAmount() != null && claim != null && claim.getEstimatedAmount() != null
                && claim.getEstimatedAmount().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal diff = survey.getEstimatedLossAmount()
                    .subtract(claim.getEstimatedAmount())
                    .abs()
                    .divide(claim.getEstimatedAmount(), 4, BigDecimal.ROUND_HALF_UP);

            if (diff.compareTo(BigDecimal.valueOf(0.5)) > 0) {
                riskFactors.add(new RiskFactor("amount_diff", "金额差异大", 15,
                        "查勘估损与报案预估差异超过50%"));
                totalScore += 15;
            }
        }

        boolean suspicious = totalScore >= suspiciousScoreThreshold;
        String flags = buildFraudFlags(riskFactors);

        return new RiskAssessmentResult(totalScore, suspicious, flags, riskFactors);
    }

    private boolean isHighFraudArea(String area) {
        List<String> highFraudAreas = List.of(
                "北京市朝阳区", "上海市浦东新区", "广州市天河区", "深圳市福田区"
        );
        return highFraudAreas.contains(area);
    }

    private String buildFraudFlags(List<RiskFactor> factors) {
        List<String> flags = new ArrayList<>();
        for (RiskFactor factor : factors) {
            if (factor.getScore() > 0) {
                flags.add(factor.getCode());
            }
        }
        return String.join(",", flags);
    }

    public Integer getSuspiciousScoreThreshold() {
        return suspiciousScoreThreshold;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class RiskAssessmentResult {
        private int totalScore;
        private boolean suspicious;
        private String fraudFlags;
        private List<RiskFactor> riskFactors;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class RiskFactor {
        private String code;
        private String name;
        private int score;
        private String description;
    }
}
