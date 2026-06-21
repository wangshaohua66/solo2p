package com.court.execution.service;

import com.court.execution.entity.*;
import com.court.execution.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DistributionService {

    private final FundRecordRepository fundRepository;
    private final DistributionPlanRepository planRepository;
    private final DistributionDetailRepository detailRepository;
    private final ExecutionCaseRepository caseRepository;
    private final UserRepository userRepository;
    private final ApprovalService approvalService;

    private int planSequence = 1;

    public DistributionService(FundRecordRepository fundRepository,
                               DistributionPlanRepository planRepository,
                               DistributionDetailRepository detailRepository,
                               ExecutionCaseRepository caseRepository,
                               UserRepository userRepository,
                               ApprovalService approvalService) {
        this.fundRepository = fundRepository;
        this.planRepository = planRepository;
        this.detailRepository = detailRepository;
        this.caseRepository = caseRepository;
        this.userRepository = userRepository;
        this.approvalService = approvalService;
    }

    private String generatePlanNumber() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String seq = String.format("%04d", planSequence++);
        return "FP-" + dateStr + "-" + seq;
    }

    @Transactional
    public FundRecord registerFund(Long caseId, String fundType, BigDecimal amount,
                                    String source, LocalDateTime receivedDate,
                                    String payerName, String operatorUsername) {
        ExecutionCase caseObj = caseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("案件不存在"));

        User operator = userRepository.findByUsername(operatorUsername)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        FundRecord fund = new FundRecord();
        fund.setExecutionCase(caseObj);
        fund.setFundType(fundType);
        fund.setAmount(amount);
        fund.setSource(source);
        fund.setReceivedDate(receivedDate != null ? receivedDate : LocalDateTime.now());
        fund.setPayerName(payerName);
        fund.setOperator(operator);

        FundRecord saved = fundRepository.save(fund);

        BigDecimal currentRealized = caseObj.getRealizedAmount() != null
                ? caseObj.getRealizedAmount() : BigDecimal.ZERO;
        caseObj.setRealizedAmount(currentRealized.add(amount));
        caseRepository.save(caseObj);

        return saved;
    }

    public FundRecord getFundById(Long id) {
        return fundRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("款项记录不存在"));
    }

    public List<FundRecord> getFundsByCaseId(Long caseId) {
        return fundRepository.findByExecutionCaseIdOrderByCreateTimeDesc(caseId);
    }

    public BigDecimal getTotalFundByCaseId(Long caseId) {
        return fundRepository.sumByCaseId(caseId);
    }

    @Transactional
    public DistributionPlan createDistributionPlan(Long caseId, String creatorUsername,
                                                    BigDecimal executionFee,
                                                    BigDecimal litigationFee,
                                                    BigDecimal evaluationFee,
                                                    BigDecimal auctionFee) {
        ExecutionCase caseObj = caseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("案件不存在"));

        User creator = userRepository.findByUsername(creatorUsername)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        BigDecimal totalAmount = fundRepository.sumByCaseId(caseId);
        if (totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("案件没有到账款项，无法创建分配方案");
        }

        executionFee = executionFee != null ? executionFee : BigDecimal.ZERO;
        litigationFee = litigationFee != null ? litigationFee : BigDecimal.ZERO;
        evaluationFee = evaluationFee != null ? evaluationFee : BigDecimal.ZERO;
        auctionFee = auctionFee != null ? auctionFee : BigDecimal.ZERO;

        BigDecimal totalFees = executionFee.add(litigationFee).add(evaluationFee).add(auctionFee);
        BigDecimal distributableAmount = totalAmount.subtract(totalFees);

        if (distributableAmount.compareTo(BigDecimal.ZERO) < 0) {
            throw new RuntimeException("费用总额超过到账金额");
        }

        DistributionPlan plan = new DistributionPlan();
        plan.setExecutionCase(caseObj);
        plan.setPlanNumber(generatePlanNumber());
        plan.setTotalAmount(totalAmount);
        plan.setExecutionFee(executionFee);
        plan.setLitigationFee(litigationFee);
        plan.setEvaluationFee(evaluationFee);
        plan.setAuctionFee(auctionFee);
        plan.setDistributableAmount(distributableAmount);
        plan.setStatus("DRAFT");
        plan.setCreator(creator);

        DistributionPlan savedPlan = planRepository.save(plan);

        if (caseObj.getCreditorName() != null && !caseObj.getCreditorName().isEmpty()) {
            DistributionDetail detail = new DistributionDetail();
            detail.setDistributionPlan(savedPlan);
            detail.setPriorityOrder(DistributionPriority.ORDINARY_CLAIM.getOrder());
            detail.setCreditorType(DistributionPriority.ORDINARY_CLAIM.getDescription());
            detail.setCreditorName(caseObj.getCreditorName());
            detail.setClaimAmount(caseObj.getExecutionAmount());
            detail.setDistributableAmount(distributableAmount);
            detail.setActualAmount(BigDecimal.ZERO);
            detail.setPayStatus("PENDING");
            detailRepository.save(detail);
            savedPlan.getDetails().add(detail);
        }

        return savedPlan;
    }

    public DistributionPlan getPlanById(Long id) {
        return planRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("分配方案不存在"));
    }

    public List<DistributionPlan> getPlansByCaseId(Long caseId) {
        return planRepository.findByExecutionCaseIdOrderByCreateTimeDesc(caseId);
    }

    @Transactional
    public DistributionDetail addDistributionDetail(Long planId, DistributionDetail detail) {
        DistributionPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("分配方案不存在"));

        if (!"DRAFT".equals(plan.getStatus())) {
            throw new RuntimeException("只有草稿状态的方案才能添加分配明细");
        }

        if (detail.getPriorityOrder() == null) {
            detail.setPriorityOrder(DistributionPriority.ORDINARY_CLAIM.getOrder());
        }
        if (detail.getCreditorType() == null || detail.getCreditorType().isEmpty()) {
            detail.setCreditorType(DistributionPriority.ORDINARY_CLAIM.getDescription());
        }

        detail.setDistributionPlan(plan);
        detail.setPayStatus("PENDING");

        DistributionDetail saved = detailRepository.save(detail);
        plan.getDetails().add(saved);

        return saved;
    }

    @Transactional
    public DistributionPlan calculateDistribution(Long planId) {
        DistributionPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("分配方案不存在"));

        List<DistributionDetail> details = detailRepository.findByDistributionPlanIdOrderByPriorityOrder(planId);

        if (details.isEmpty()) {
            throw new RuntimeException("分配方案没有明细");
        }

        BigDecimal remaining = plan.getDistributableAmount();

        Map<Integer, List<DistributionDetail>> groupedByPriority = details.stream()
                .collect(Collectors.groupingBy(
                        d -> d.getPriorityOrder() != null ? d.getPriorityOrder() : DistributionPriority.ORDINARY_CLAIM.getOrder(),
                        TreeMap::new,
                        Collectors.toList()
                ));

        for (Map.Entry<Integer, List<DistributionDetail>> entry : groupedByPriority.entrySet()) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
                for (DistributionDetail detail : entry.getValue()) {
                    detail.setDistributableAmount(BigDecimal.ZERO);
                    detail.setActualAmount(BigDecimal.ZERO);
                    detailRepository.save(detail);
                }
                continue;
            }

            List<DistributionDetail> samePriorityDetails = entry.getValue();
            BigDecimal totalClaim = samePriorityDetails.stream()
                    .map(d -> d.getClaimAmount() != null ? d.getClaimAmount() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (totalClaim.compareTo(BigDecimal.ZERO) <= 0) {
                BigDecimal share = remaining.divide(BigDecimal.valueOf(samePriorityDetails.size()), 2, RoundingMode.HALF_UP);
                for (DistributionDetail detail : samePriorityDetails) {
                    detail.setDistributableAmount(share);
                    detail.setActualAmount(share);
                    detailRepository.save(detail);
                }
                remaining = BigDecimal.ZERO;
            } else if (remaining.compareTo(totalClaim) >= 0) {
                for (DistributionDetail detail : samePriorityDetails) {
                    BigDecimal claim = detail.getClaimAmount() != null ? detail.getClaimAmount() : BigDecimal.ZERO;
                    detail.setDistributableAmount(claim);
                    detail.setActualAmount(claim);
                    detailRepository.save(detail);
                }
                remaining = remaining.subtract(totalClaim);
            } else {
                for (DistributionDetail detail : samePriorityDetails) {
                    BigDecimal claim = detail.getClaimAmount() != null ? detail.getClaimAmount() : BigDecimal.ZERO;
                    BigDecimal ratio = claim.divide(totalClaim, 10, RoundingMode.HALF_UP);
                    BigDecimal actual = remaining.multiply(ratio).setScale(2, RoundingMode.HALF_UP);
                    detail.setDistributableAmount(actual);
                    detail.setActualAmount(actual);
                    detailRepository.save(detail);
                }
                remaining = BigDecimal.ZERO;
            }
        }

        return plan;
    }

    @Transactional
    public DistributionPlan approvePlan(Long planId, String approverUsername, boolean approved) {
        DistributionPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("分配方案不存在"));

        User approver = userRepository.findByUsername(approverUsername)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        plan.setApprover(approver);
        plan.setApprovalTime(LocalDateTime.now());
        plan.setStatus(approved ? "APPROVED" : "REJECTED");

        return planRepository.save(plan);
    }

    @Transactional
    public DistributionPlan requestPlanApproval(Long planId, String applicantUsername) {
        DistributionPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("分配方案不存在"));

        if (!"DRAFT".equals(plan.getStatus())) {
            throw new RuntimeException("只有草稿状态的方案才能提交审批");
        }

        User applicant = userRepository.findByUsername(applicantUsername)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        String title = plan.getPlanNumber() + "-" + plan.getExecutionCase().getCaseName();
        approvalService.createApprovalTask(
                ApprovalType.DISTRIBUTION_PLAN,
                plan.getId(),
                title,
                applicant.getId()
        );

        plan.setStatus("PENDING_APPROVAL");
        return planRepository.save(plan);
    }

    @Transactional
    public DistributionPlan executeDistribution(Long planId) {
        DistributionPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("分配方案不存在"));

        if (!"APPROVED".equals(plan.getStatus())) {
            throw new RuntimeException("只有审批通过的方案才能执行发放");
        }

        List<DistributionDetail> details = detailRepository.findByDistributionPlanIdOrderByPriorityOrder(planId);
        for (DistributionDetail detail : details) {
            detail.setPayStatus("PAID");
            detail.setPayTime(LocalDateTime.now());
            detail.setVoucherNumber("PAY-" + System.currentTimeMillis() + "-" + detail.getId());
            detailRepository.save(detail);
        }

        plan.setStatus("COMPLETED");
        plan.setDistributeTime(LocalDateTime.now());

        return planRepository.save(plan);
    }

    public Page<FundRecord> getFundsByCaseId(Long caseId, Pageable pageable) {
        return fundRepository.findByExecutionCaseId(caseId, pageable);
    }
}
