package com.insurance.claim.service;

import com.insurance.claim.entity.Claim;
import com.insurance.claim.entity.Policy;
import com.insurance.claim.entity.Survey;
import com.insurance.claim.enums.ClaimStatus;
import com.insurance.claim.mapper.ClaimRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FraudDetectionService {

    private final ClaimRepository claimMapper;
    private final RiskAssessmentEngine riskAssessmentEngine;
    private final PolicyService policyService;

    public void detectFraudOnReport(Claim claim) {
        log.info("开始欺诈检测: 报案阶段 - 案件{}", claim.getClaimNo());

        Policy policy = policyService.getPolicyByNo(claim.getPolicyNo());
        RiskAssessmentEngine.RiskAssessmentResult result = riskAssessmentEngine.assessClaimRisk(claim, policy);

        updateClaimFraudInfo(claim.getId(), result);

        if (result.isSuspicious()) {
            log.warn("检测到高欺诈风险: 案件{}, 得分{}, 标记: {}",
                    claim.getClaimNo(), result.getTotalScore(), result.getFraudFlags());
        }
    }

    public void detectFraudOnSurvey(Survey survey) {
        log.info("开始欺诈检测: 查勘阶段 - 查勘记录{}", survey.getId());

        Claim claim = claimRepository.selectById(survey.getClaimId());
        RiskAssessmentEngine.RiskAssessmentResult result = riskAssessmentEngine.assessSurveyRisk(survey, claim);
        if (claim != null) {
            int combinedScore = (claim.getFraudScore() != null ? claim.getFraudScore() : 0)
                    + result.getTotalScore();
            boolean combinedSuspicious = combinedScore >= riskAssessmentEngine.getSuspiciousScoreThreshold();

            String combinedFlags = mergeFlags(claim.getFraudFlags(), result.getFraudFlags());

            claimRepository.updateFraudInfo(claim.getId(), combinedScore, combinedFlags, combinedSuspicious);

            if (combinedSuspicious && !Boolean.TRUE.equals(claim.getFraudSuspicious())) {
                log.warn("查勘后确认高欺诈风险: 案件{}, 综合得分{}", claim.getClaimNo(), combinedScore);
                handleSuspiciousClaim(claim.getId(), combinedScore, combinedFlags);
            }
        }
    }

    public void detectFraudOnAssessment(Long claimId) {
        log.info("开始欺诈检测: 定损阶段 - 案件{}", claimId);

        Claim claim = claimRepository.selectById(claimId);
        if (claim == null) {
            return;
        }

        List<String> newFlags = new ArrayList<>();
        int additionalScore = 0;

        if (claim.getTotalLossAmount() != null && claim.getEstimatedAmount() != null) {
            java.math.BigDecimal diff = claim.getTotalLossAmount()
                    .subtract(claim.getEstimatedAmount())
                    .abs();
            if (claim.getEstimatedAmount().compareTo(java.math.BigDecimal.ZERO) > 0) {
                java.math.BigDecimal ratio = diff.divide(claim.getEstimatedAmount(), 4, java.math.BigDecimal.ROUND_HALF_UP);
                if (ratio.compareTo(java.math.BigDecimal.valueOf(0.6)) > 0) {
                    newFlags.add("assessment_overrun");
                    additionalScore += 20;
                    log.warn("定损金额远超报案预估: 案件{}, 预估{}, 定损{}",
                            claimId, claim.getEstimatedAmount(), claim.getTotalLossAmount());
                }
            }
        }

        if (additionalScore > 0) {
            int combinedScore = (claim.getFraudScore() != null ? claim.getFraudScore() : 0) + additionalScore;
            String combinedFlags = mergeFlags(claim.getFraudFlags(), String.join(",", newFlags));
            boolean combinedSuspicious = combinedScore >= riskAssessmentEngine.getSuspiciousScoreThreshold();

            claimRepository.updateFraudInfo(claimId, combinedScore, combinedFlags, combinedSuspicious);

            if (combinedSuspicious) {
                handleSuspiciousClaim(claimId, combinedScore, combinedFlags);
            }
        }
    }

    public void detectFraudOnReview(Long claimId) {
        log.info("开始欺诈检测: 核赔阶段 - 案件{}", claimId);

        Claim claim = claimRepository.selectById(claimId);
        if (claim == null) {
            return;
        }

        List<String> patternFlags = detectFraudPatterns(claim);
        if (!patternFlags.isEmpty()) {
            int patternScore = patternFlags.size() * 15;
            int combinedScore = (claim.getFraudScore() != null ? claim.getFraudScore() : 0) + patternScore;
            String combinedFlags = mergeFlags(claim.getFraudFlags(), String.join(",", patternFlags));
            boolean combinedSuspicious = combinedScore >= riskAssessmentEngine.getSuspiciousScoreThreshold();

            claimRepository.updateFraudInfo(claimId, combinedScore, combinedFlags, combinedSuspicious);

            if (combinedSuspicious) {
                log.warn("核赔阶段检测到欺诈模式: 案件{}, 模式: {}", claimId, patternFlags);
                handleSuspiciousClaim(claimId, combinedScore, combinedFlags);
            }
        }
    }

    private List<String> detectFraudPatterns(Claim claim) {
        List<String> patterns = new ArrayList<>();

        if (claim.getReporterIdCard() != null) {
            int recentClaims = claimRepository.countClaimsByIdCardAndDays(claim.getReporterIdCard(), 90);
            if (recentClaims >= 5) {
                patterns.add("serial_claimant");
            }
        }

        if (claim.getPolicyNo() != null) {
            List<Claim> policyClaims = claimRepository.selectByPolicyNo(claim.getPolicyNo());
            if (policyClaims.size() >= 3) {
                patterns.add("high_frequency_policy");
            }
        }

        if (claim.getAccidentTime() != null && claim.getReportedAt() != null) {
            long hours = java.time.Duration.between(claim.getAccidentTime(), claim.getReportedAt()).toHours();
            if (hours > 48) {
                patterns.add("delayed_reporting");
            }
        }

        if (claim.getLiabilityRatio() != null && claim.getLiabilityRatio() == 100) {
            patterns.add("full_liability");
        }

        return patterns;
    }

    private void handleSuspiciousClaim(Long claimId, int score, String flags) {
        try {
            Claim claim = claimRepository.selectById(claimId);
            if (claim != null && claim.getStatus() != ClaimStatus.FRAUD_SUSPICIOUS) {
                claimRepository.updateStatus(claimId, ClaimStatus.FRAUD_SUSPICIOUS.getCode(), claim.getVersion());
                log.info("案件已标记为欺诈可疑并转入人工复核: {}", claim.getClaimNo());
            }
        } catch (Exception e) {
            log.error("处理可疑案件失败: {}", claimId, e);
        }
    }

    private void updateClaimFraudInfo(Long claimId, RiskAssessmentEngine.RiskAssessmentResult result) {
        claimRepository.updateFraudInfo(claimId, result.getTotalScore(), result.getFraudFlags(), result.isSuspicious());
    }

    private String mergeFlags(String existingFlags, String newFlags) {
        java.util.Set<String> flagSet = new java.util.HashSet<>();
        if (existingFlags != null && !existingFlags.isEmpty()) {
            flagSet.addAll(java.util.Arrays.asList(existingFlags.split(",")));
        }
        if (newFlags != null && !newFlags.isEmpty()) {
            flagSet.addAll(java.util.Arrays.asList(newFlags.split(",")));
        }
        return String.join(",", flagSet);
    }

    public boolean isClaimSuspicious(Long claimId) {
        Claim claim = claimRepository.selectById(claimId);
        return claim != null && Boolean.TRUE.equals(claim.getFraudSuspicious());
    }

    public int getFraudScore(Long claimId) {
        Claim claim = claimRepository.selectById(claimId);
        return claim != null && claim.getFraudScore() != null ? claim.getFraudScore() : 0;
    }
}
