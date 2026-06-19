package com.talentmarket.common.utils;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class BoothAllocationAlgorithm {

    private static final double INDUSTRY_WEIGHT = 0.30;
    private static final double SCALE_WEIGHT = 0.25;
    private static final double POSITION_COUNT_WEIGHT = 0.25;
    private static final double RECRUITMENT_URGENCY_WEIGHT = 0.10;
    private static final double HISTORY_SCORE_WEIGHT = 0.10;

    @Data
    @AllArgsConstructor
    public static class EnterpriseBoothRequest {
        private Long enterpriseId;
        private String enterpriseName;
        private String industry;
        private Integer employeeCount;
        private Integer positionCount;
        private Integer recruitmentUrgency;
        private Double historyScore;
    }

    @Data
    public static class Booth {
        private Long boothId;
        private String boothCode;
        private String area;
        private Integer boothNumber;
        private String boothType;
        private Integer qualityScore;
    }

    @Data
    public static class AllocationResult {
        private Long enterpriseId;
        private String enterpriseName;
        private Booth booth;
        private Double matchScore;
        private Integer rank;
    }

    public List<AllocationResult> allocateBooths(List<EnterpriseBoothRequest> enterprises, List<Booth> booths) {
        log.info("开始展位分配，企业数: {}, 展位总数: {}", enterprises.size(), booths.size());

        if (enterprises.size() > booths.size()) {
            log.warn("企业数量大于展位数量，部分企业将无法分配展位");
        }

        Map<String, List<Booth>> boothsByArea = groupBoothsByArea(booths);
        Map<EnterpriseBoothRequest, Double> enterpriseScores = calculateEnterpriseScores(enterprises);

        List<Map.Entry<EnterpriseBoothRequest, Double>> sortedEnterprises = new ArrayList<>(enterpriseScores.entrySet());
        sortedEnterprises.sort((e1, e2) -> Double.compare(e2.getValue(), e1.getValue()));

        List<AllocationResult> results = new ArrayList<>();
        Set<Long> allocatedBoothIds = new HashSet<>();
        int rank = 1;

        for (Map.Entry<EnterpriseBoothRequest, Double> entry : sortedEnterprises) {
            EnterpriseBoothRequest enterprise = entry.getKey();
            double enterpriseScore = entry.getValue();

            Booth bestBooth = findBestBooth(enterprise, boothsByArea, allocatedBoothIds, enterpriseScore);

            if (bestBooth != null) {
                AllocationResult result = new AllocationResult();
                result.setEnterpriseId(enterprise.getEnterpriseId());
                result.setEnterpriseName(enterprise.getEnterpriseName());
                result.setBooth(bestBooth);
                result.setMatchScore(calculateFinalMatchScore(enterprise, bestBooth));
                result.setRank(rank++);
                results.add(result);
                allocatedBoothIds.add(bestBooth.getBoothId());
                log.info("企业 {} 分配到展位 {} (区域: {}, 匹配度: {})",
                        enterprise.getEnterpriseName(), bestBooth.getBoothCode(),
                        bestBooth.getArea(), result.getMatchScore());
            }
        }

        log.info("展位分配完成，成功分配 {} 个展位", results.size());
        return results;
    }

    private Map<String, List<Booth>> groupBoothsByArea(List<Booth> booths) {
        Map<String, List<Booth>> result = new HashMap<>();
        for (Booth booth : booths) {
            result.computeIfAbsent(booth.getArea(), k -> new ArrayList<>()).add(booth);
        }
        return result;
    }

    private Map<EnterpriseBoothRequest, Double> calculateEnterpriseScores(List<EnterpriseBoothRequest> enterprises) {
        Map<EnterpriseBoothRequest, Double> scores = new HashMap<>();

        for (EnterpriseBoothRequest enterprise : enterprises) {
            double score = 0.0;

            score += SCALE_WEIGHT * calculateScaleScore(enterprise.getEmployeeCount());
            score += POSITION_COUNT_WEIGHT * calculatePositionCountScore(enterprise.getPositionCount());
            score += RECRUITMENT_URGENCY_WEIGHT * enterprise.getRecruitmentUrgency() / 10.0;
            score += HISTORY_SCORE_WEIGHT * enterprise.getHistoryScore();

            scores.put(enterprise, score);
        }

        return scores;
    }

    private double calculateScaleScore(Integer employeeCount) {
        if (employeeCount == null || employeeCount <= 0) return 0.3;
        if (employeeCount >= 1000) return 1.0;
        if (employeeCount >= 500) return 0.9;
        if (employeeCount >= 100) return 0.7;
        if (employeeCount >= 50) return 0.5;
        return 0.3;
    }

    private double calculatePositionCountScore(Integer positionCount) {
        if (positionCount == null || positionCount <= 0) return 0.2;
        if (positionCount >= 50) return 1.0;
        if (positionCount >= 30) return 0.85;
        if (positionCount >= 15) return 0.7;
        if (positionCount >= 5) return 0.5;
        return 0.3;
    }

    private Booth findBestBooth(EnterpriseBoothRequest enterprise,
                                Map<String, List<Booth>> boothsByArea,
                                Set<Long> allocatedBoothIds,
                                double enterpriseScore) {
        List<Booth> areaBooths = boothsByArea.getOrDefault(enterprise.getIndustry(), Collections.emptyList());

        Booth bestBooth = null;
        double bestScore = -1;

        for (Booth booth : areaBooths) {
            if (allocatedBoothIds.contains(booth.getBoothId())) continue;

            double score = booth.getQualityScore() * 0.6 + enterpriseScore * 0.4;
            if (score > bestScore) {
                bestScore = score;
                bestBooth = booth;
            }
        }

        if (bestBooth == null) {
            for (List<Booth> boothList : boothsByArea.values()) {
                for (Booth booth : boothList) {
                    if (allocatedBoothIds.contains(booth.getBoothId())) continue;

                    double score = booth.getQualityScore() * 0.5;
                    if (score > bestScore) {
                        bestScore = score;
                        bestBooth = booth;
                    }
                }
            }
        }

        return bestBooth;
    }

    private double calculateFinalMatchScore(EnterpriseBoothRequest enterprise, Booth booth) {
        double score = 0.0;

        if (booth.getArea() != null && booth.getArea().equals(enterprise.getIndustry())) {
            score += INDUSTRY_WEIGHT;
        } else {
            score += INDUSTRY_WEIGHT * 0.5;
        }

        score += SCALE_WEIGHT * calculateScaleScore(enterprise.getEmployeeCount());
        score += POSITION_COUNT_WEIGHT * calculatePositionCountScore(enterprise.getPositionCount());
        score += RECRUITMENT_URGENCY_WEIGHT * enterprise.getRecruitmentUrgency() / 10.0;
        score += HISTORY_SCORE_WEIGHT * enterprise.getHistoryScore();

        return Math.round(score * 100.0) / 100.0;
    }

    public List<Booth> generateBoothLayout(String[] areas, int boothsPerArea) {
        List<Booth> booths = new ArrayList<>();
        long boothId = 1L;

        for (String area : areas) {
            for (int i = 1; i <= boothsPerArea; i++) {
                Booth booth = new Booth();
                booth.setBoothId(boothId++);
                booth.setBoothCode(area + "-" + String.format("%02d", i));
                booth.setArea(area);
                booth.setBoothNumber(i);
                booth.setBoothType(i <= 5 ? "标准展位" : "普通展位");
                booth.setQualityScore(calculateBoothQuality(i, boothsPerArea));
                booths.add(booth);
            }
        }

        return booths;
    }

    private int calculateBoothQuality(int position, int total) {
        double ratio = (double) position / total;
        if (ratio <= 0.2) return 95;
        if (ratio <= 0.4) return 85;
        if (ratio <= 0.6) return 75;
        if (ratio <= 0.8) return 65;
        return 55;
    }
}
