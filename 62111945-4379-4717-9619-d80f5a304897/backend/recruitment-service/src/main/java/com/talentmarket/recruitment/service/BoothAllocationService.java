package com.talentmarket.recruitment.service;

import com.talentmarket.common.utils.BoothAllocationAlgorithm;
import com.talentmarket.recruitment.entity.FairBooth;
import com.talentmarket.recruitment.mapper.FairBoothMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BoothAllocationService {

    private final FairBoothMapper fairBoothMapper;
    private final BoothAllocationAlgorithm boothAllocationAlgorithm;

    @Transactional(rollbackFor = Exception.class)
    public List<FairBooth> allocateBooths(Long fairId, List<BoothEnterpriseRequest> enterpriseRequests,
                                        String[] areas, int boothsPerArea) {
        log.info("开始智能分配展位，招聘会ID: {}, 企业数: {}", fairId, enterpriseRequests.size());

        List<BoothAllocationAlgorithm.Booth> booths = boothAllocationAlgorithm.generateBoothLayout(areas, boothsPerArea);
        log.info("生成展位布局完成，总展位数: {}", booths.size());

        List<BoothAllocationAlgorithm.EnterpriseBoothRequest> enterpriseBoothRequests = enterpriseRequests.stream()
                .map(req -> new BoothAllocationAlgorithm.EnterpriseBoothRequest(
                        req.getEnterpriseId(),
                        req.getEnterpriseName(),
                        req.getIndustry(),
                        req.getEmployeeCount(),
                        req.getPositionCount(),
                        req.getRecruitmentUrgency(),
                        req.getHistoryScore() != null ? req.getHistoryScore().doubleValue() : 0.0
                ))
                .collect(Collectors.toList());

        List<BoothAllocationAlgorithm.AllocationResult> results =
                boothAllocationAlgorithm.allocateBooths(enterpriseBoothRequests, booths);

        List<FairBooth> fairBooths = new ArrayList<>();
        Map<Long, BoothAllocationAlgorithm.AllocationResult> resultMap = new HashMap<>();
        for (BoothAllocationAlgorithm.AllocationResult result : results) {
            resultMap.put(result.getEnterpriseId(), result);
        }

        for (BoothAllocationAlgorithm.Booth booth : booths) {
            FairBooth fairBooth = new FairBooth();
            fairBooth.setFairId(fairId);
            fairBooth.setBoothCode(booth.getBoothCode());
            fairBooth.setBoothArea(booth.getArea());
            fairBooth.setBoothNumber(booth.getBoothNumber());
            fairBooth.setBoothType(booth.getBoothType());
            fairBooth.setQualityScore(booth.getQualityScore());
            fairBooth.setStatus(0);
            
            BoothAllocationAlgorithm.AllocationResult allocation =
                    resultMap.entrySet().stream()
                            .filter(e -> e.getValue().getBooth().getBoothId().equals(booth.getBoothId()))
                            .findFirst()
                            .map(Map.Entry::getValue)
                            .orElse(null);

            if (allocation != null) {
                fairBooth.setEnterpriseId(allocation.getEnterpriseId());
                fairBooth.setEnterpriseName(allocation.getEnterpriseName());
                fairBooth.setStatus(1);
                fairBooth.setMatchScore(allocation.getMatchScore());
            }
            
            fairBooths.add(fairBooth);
        }

        fairBoothMapper.batchInsert(fairBooths);
        log.info("展位分配完成，已分配展位: {}", results.size());

        return fairBooths;
    }

    public List<FairBooth> getBoothsByFairId(Long fairId) {
        return fairBoothMapper.selectByFairId(fairId);
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean assignBooth(Long boothId, Long enterpriseId, String enterpriseName) {
        FairBooth booth = fairBoothMapper.selectById(boothId);
        if (booth == null) {
            return false;
        }
        if (booth.getStatus() != null && booth.getStatus() == 1) {
            throw new RuntimeException("该展位已被分配");
        }

        FairBooth update = new FairBooth();
        update.setId(boothId);
        update.setEnterpriseId(enterpriseId);
        update.setEnterpriseName(enterpriseName);
        update.setStatus(1);

        return fairBoothMapper.updateById(update) > 0;
    }

    @lombok.Data
    public static class BoothEnterpriseRequest {
        private Long enterpriseId;
        private String enterpriseName;
        private String industry;
        private Integer employeeCount;
        private Integer positionCount;
        private Integer recruitmentUrgency;
        private Integer historyScore;
    }
}
