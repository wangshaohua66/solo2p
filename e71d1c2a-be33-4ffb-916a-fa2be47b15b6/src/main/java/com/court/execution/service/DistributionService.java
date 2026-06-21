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
import java.util.ArrayList;
import java.util.List;

@Service
public class DistributionService {

    private final FundRecordRepository fundRepository;
    private final DistributionPlanRepository planRepository;
    private final DistributionDetailRepository detailRepository;
    private final ExecutionCaseRepository caseRepository;
    private final UserRepository userRepository;

    private int planSequence = 1;

    public DistributionService(FundRecordRepository fundRepository,
                               DistributionPlanRepository planRepository,
                               DistributionDetailRepository detailRepository,
                               ExecutionCaseRepository caseRepository,
                               UserRepository userRepository) {
        this.fundRepository = fundRepository;
        this.planRepository = planRepository;
        this.detailRepository = detailRepository;
        this.caseRepository = caseRepository;
        this.userRepository = userRepository;
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
            detail.setPriorityOrder(1);
            detail.setCreditorType("申请执行人");
            detail.setCreditorName(caseObj.getCreditorName());
            detail.setClaimAmount(caseObj.getExecutionAmount());
            detail.setDistributableAmount(distributableAmount);
            detail.setActualAmount(distributableAmount);
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

        detail.setDistributionPlan(plan);
        detail.setPayStatus("PENDING");

        DistributionDetail saved = detailRepository.save(detail);
        plan.getDetails().add(saved);

        recalculatePlan(plan);

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

        for (DistributionDetail detail : details) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
                detail.setActualAmount(BigDecimal.ZERO);
            } else if (detail.getClaimAmount() != null && remaining.compareTo(detail.getClaimAmount()) >= 0) {
                detail.setActualAmount(detail.getClaimAmount());
                remaining = remaining.subtract(detail.getClaimAmount());
            } else {
                detail.setActualAmount(remaining);
                remaining = BigDecimal.ZERO;
            }
            detail.setDistributableAmount(detail.getActualAmount());
            detailRepository.save(detail);
        }

        return plan;
    }

    private void recalculatePlan(DistributionPlan plan) {
        List<DistributionDetail> details = detailRepository.findByDistributionPlanIdOrderByPriorityOrder(plan.getId());

        BigDecimal totalClaim = details.stream()
                .map(d -> d.getClaimAmount() != null ? d.getClaimAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal distributable = plan.getDistributableAmount();

        for (DistributionDetail detail : details) {
            if (totalClaim.compareTo(BigDecimal.ZERO) > 0 && detail.getClaimAmount() != null) {
                BigDecimal ratio = detail.getClaimAmount().divide(totalClaim, 10, RoundingMode.HALF_UP);
                detail.setDistributableAmount(distributable.multiply(ratio).setScale(2, RoundingMode.HALF_UP));
            }
            detailRepository.save(detail);
        }
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
