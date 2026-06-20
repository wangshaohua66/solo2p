package com.tvstation.media.service.impl;

import com.tvstation.media.entity.Copyright;
import com.tvstation.media.entity.Material;
import com.tvstation.media.repository.CopyrightRepository;
import com.tvstation.media.repository.MaterialRepository;
import com.tvstation.media.service.CopyrightRiskAssessmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CopyrightRiskAssessmentServiceImpl implements CopyrightRiskAssessmentService {

    private final CopyrightRepository copyrightRepository;
    private final MaterialRepository materialRepository;

    private static final int RISK_THRESHOLD_LOW = 20;
    private static final int RISK_THRESHOLD_MEDIUM = 40;
    private static final int RISK_THRESHOLD_HIGH = 70;

    @Override
    @Transactional
    public Copyright assessRisk(Copyright copyright) {
        int score = calculateRiskScore(copyright);
        Copyright.RiskLevel level = determineRiskLevel(score);
        List<String> factors = identifyRiskFactors(copyright);

        copyright.setRiskScore(score);
        copyright.setRiskLevel(level);
        copyright.setRiskFactors(factors.isEmpty() ? null : String.join("；", factors));

        Copyright saved = copyrightRepository.save(copyright);
        log.info("Copyright risk assessed: id={}, name={}, score={}, level={}",
                saved.getId(), saved.getName(), score, level);
        return saved;
    }

    @Override
    @Transactional
    public List<Copyright> assessAllRisks() {
        List<Copyright> all = copyrightRepository.findAll();
        List<Copyright> assessed = new ArrayList<>();
        for (Copyright c : all) {
            if (!c.getDeleted()) {
                assessed.add(assessRisk(c));
            }
        }
        log.info("Assessed risk for {} copyrights", assessed.size());
        return assessed;
    }

    @Override
    public int calculateRiskScore(Copyright copyright) {
        int score = 0;
        LocalDate now = LocalDate.now();

        if (copyright.getEndDate().isBefore(now)) {
            score += 40;
        } else if (copyright.getEndDate().isBefore(now.plusDays(7))) {
            score += 20;
        } else if (copyright.getEndDate().isBefore(now.plusDays(30)) && copyright.getEndDate().isBefore(now.plusDays(7)) == false) {
            score += 5;
        }

        if (copyright.getAuthorizationScope() == null || copyright.getAuthorizationScope().isEmpty()) {
            score += 15;
        } else {
            String scope = copyright.getAuthorizationScope().toLowerCase();
            if (!scope.contains("电视") && !scope.contains("播出") && !scope.contains("全网") && !scope.contains("全渠道")) {
                score += 10;
            }
            if (scope.contains("限制") || scope.contains("仅限") || scope.contains("不可")) {
                score += 5;
            }
        }

        if (copyright.getCost() != null && copyright.getCost().intValue() < 1000) {
            score += 10;
        }

        if (copyright.getStatus() == Copyright.CopyrightStatus.expired && !copyright.getMaterialIds().isEmpty()) {
            score += 30;
        }

        if (copyright.getContractUrl() == null || copyright.getContractUrl().isEmpty()) {
            score += 10;
        }

        if (copyright.getMaterialIds() != null) {
            for (Long materialId : copyright.getMaterialIds()) {
                materialRepository.findById(materialId).ifPresent(material -> {
                    if (material.getCopyrightId() == null || !material.getCopyrightId().equals(copyright.getId())) {
                        log.warn("Material {} has mismatched copyrightId", materialId);
                    }
                });
            }
        }

        return Math.min(score, 100);
    }

    @Override
    public Copyright.RiskLevel determineRiskLevel(int score) {
        if (score >= RISK_THRESHOLD_HIGH) {
            return Copyright.RiskLevel.high;
        } else if (score >= RISK_THRESHOLD_MEDIUM) {
            return Copyright.RiskLevel.medium;
        } else if (score >= RISK_THRESHOLD_LOW) {
            return Copyright.RiskLevel.low;
        } else {
            return Copyright.RiskLevel.none;
        }
    }

    @Override
    public List<String> identifyRiskFactors(Copyright copyright) {
        List<String> factors = new ArrayList<>();
        LocalDate now = LocalDate.now();

        if (copyright.getEndDate().isBefore(now)) {
            factors.add("版权已过期，但可能仍有关联素材在使用");
        } else if (copyright.getEndDate().isBefore(now.plusDays(7))) {
            factors.add("版权将在7天内到期，存在续期不及时导致侵权风险");
        }

        if (copyright.getAuthorizationScope() == null || copyright.getAuthorizationScope().isEmpty()) {
            factors.add("授权范围未明确，存在超范围使用风险");
        } else {
            String scope = copyright.getAuthorizationScope().toLowerCase();
            if (!scope.contains("电视") && !scope.contains("播出") && !scope.contains("全网")) {
                factors.add("授权范围可能不包含电视播出，需确认使用场景");
            }
        }

        if (copyright.getCost() != null && copyright.getCost().intValue() < 1000) {
            factors.add("授权费用异常偏低，需核实版权来源合法性");
        }

        if (copyright.getContractUrl() == null || copyright.getContractUrl().isEmpty()) {
            factors.add("缺少授权合同文件，存在法律证据不足风险");
        }

        if (copyright.getStatus() == Copyright.CopyrightStatus.expired && copyright.getMaterialIds() != null && !copyright.getMaterialIds().isEmpty()) {
            factors.add("已过期版权仍关联素材，存在继续使用侵权风险");
        }

        return factors;
    }

    @Override
    public List<Copyright> getHighRiskCopyrights() {
        return copyrightRepository.findByRiskLevelInAndDeletedFalse(
                List.of(Copyright.RiskLevel.high, Copyright.RiskLevel.critical));
    }
}
