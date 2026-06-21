package com.court.execution.service;

import com.court.execution.dto.CaseFilingRequest;
import com.court.execution.entity.*;
import com.court.execution.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class ExecutionService {

    private final ExecutionCaseRepository caseRepository;
    private final PropertyRepository propertyRepository;
    private final SeizureRecordRepository seizureRepository;
    private final AuctionRepository auctionRepository;
    private final FundRecordRepository fundRepository;
    private final DistributionPlanRepository distributionRepository;
    private final UserRepository userRepository;

    public ExecutionService(ExecutionCaseRepository caseRepository,
                            PropertyRepository propertyRepository,
                            SeizureRecordRepository seizureRepository,
                            AuctionRepository auctionRepository,
                            FundRecordRepository fundRepository,
                            DistributionPlanRepository distributionRepository,
                            UserRepository userRepository) {
        this.caseRepository = caseRepository;
        this.propertyRepository = propertyRepository;
        this.seizureRepository = seizureRepository;
        this.auctionRepository = auctionRepository;
        this.fundRepository = fundRepository;
        this.distributionRepository = distributionRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ExecutionCase fileCase(CaseFilingRequest request) {
        if (caseRepository.existsByCaseNumber(request.getCaseNumber())) {
            throw new RuntimeException("案号已存在: " + request.getCaseNumber());
        }

        ExecutionCase caseObj = new ExecutionCase();
        caseObj.setCaseNumber(request.getCaseNumber());
        caseObj.setCaseName(request.getCaseName());
        caseObj.setExecutionBasis(request.getExecutionBasis());
        caseObj.setExecutionAmount(request.getExecutionAmount());
        caseObj.setDebtorName(request.getDebtorName());
        caseObj.setDebtorIdCard(request.getDebtorIdCard());
        caseObj.setDebtorAddress(request.getDebtorAddress());
        caseObj.setDebtorPhone(request.getDebtorPhone());
        caseObj.setCreditorName(request.getCreditorName());
        caseObj.setStatus(CaseStatus.FILING);
        caseObj.setFilingDate(LocalDateTime.now());
        caseObj.setRemark(request.getRemark());

        if (request.getJudgeId() != null) {
            User judge = userRepository.findById(request.getJudgeId())
                    .orElseThrow(() -> new RuntimeException("法官不存在"));
            caseObj.setJudge(judge);
        }

        if (request.getAssistantId() != null) {
            User assistant = userRepository.findById(request.getAssistantId())
                    .orElseThrow(() -> new RuntimeException("助理不存在"));
            caseObj.setAssistant(assistant);
        }

        return caseRepository.save(caseObj);
    }

    public ExecutionCase getCaseById(Long id) {
        return caseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("案件不存在"));
    }

    public Page<ExecutionCase> searchCases(String caseNumber, String debtorName,
                                           Long judgeId, CaseStatus status, Pageable pageable) {
        return caseRepository.findByConditions(caseNumber, debtorName, judgeId, status, pageable);
    }

    @Transactional
    public ExecutionCase updateCaseStatus(Long caseId, CaseStatus newStatus) {
        ExecutionCase caseObj = getCaseById(caseId);
        caseObj.setStatus(newStatus);

        if (newStatus == CaseStatus.CLOSED) {
            caseObj.setCloseDate(LocalDateTime.now());
        }

        return caseRepository.save(caseObj);
    }

    @Transactional
    public ExecutionCase closeCase(Long caseId) {
        ExecutionCase caseObj = getCaseById(caseId);

        long unseizedCount = propertyRepository.findByExecutionCaseId(caseId).stream()
                .filter(p -> p.getSeized() && p.getSeizeExpireDate() != null
                        && p.getSeizeExpireDate().isAfter(LocalDateTime.now()))
                .count();
        if (unseizedCount > 0) {
            throw new RuntimeException("存在未解封的财产，不能结案");
        }

        long pendingAuctions = auctionRepository.findByExecutionCaseIdOrderByCreateTimeDesc(caseId).stream()
                .filter(a -> a.getStatus() == AuctionStatus.BIDDING
                        || a.getStatus() == AuctionStatus.ANNOUNCED
                        || a.getStatus() == AuctionStatus.EVALUATING)
                .count();
        if (pendingAuctions > 0) {
            throw new RuntimeException("存在未完成的拍卖，不能结案");
        }

        long pendingDistributions = distributionRepository.findByExecutionCaseIdOrderByCreateTimeDesc(caseId).stream()
                .filter(d -> !"COMPLETED".equals(d.getStatus()))
                .count();
        if (pendingDistributions > 0) {
            throw new RuntimeException("存在未完成的款项分配，不能结案");
        }

        caseObj.setStatus(CaseStatus.CLOSED);
        caseObj.setCloseDate(LocalDateTime.now());

        return caseRepository.save(caseObj);
    }

    public boolean canCloseCase(Long caseId) {
        try {
            closeCase(caseId);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
