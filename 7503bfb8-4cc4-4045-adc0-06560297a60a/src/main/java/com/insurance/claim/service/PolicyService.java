package com.insurance.claim.service;

import com.insurance.claim.common.BusinessException;
import com.insurance.claim.common.ResultCode;
import com.insurance.claim.entity.Policy;
import com.insurance.claim.enums.InsuranceType;
import com.insurance.claim.mapper.PolicyMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PolicyService {

    private final PolicyMapper policyMapper;

    public Policy getPolicyByNo(String policyNo) {
        Policy policy = policyMapper.selectByPolicyNo(policyNo);
        if (policy == null) {
            throw new BusinessException(ResultCode.POLICY_NOT_FOUND);
        }
        return policy;
    }

    public Policy getPolicyById(Long id) {
        Policy policy = policyMapper.selectById(id);
        if (policy == null) {
            throw new BusinessException(ResultCode.POLICY_NOT_FOUND);
        }
        return policy;
    }

    public void validatePolicy(String policyNo, InsuranceType insuranceType) {
        Policy policy = getPolicyByNo(policyNo);

        if (!policy.getInsuranceType().equals(insuranceType)) {
            throw new BusinessException("险种与保单不匹配");
        }

        if (policy.getPolicyStatus() != 1) {
            throw new BusinessException("保单状态异常，无法理赔");
        }

        LocalDate today = LocalDate.now();
        if (policy.getEffectiveDate() != null && policy.getEffectiveDate().isAfter(today)) {
            throw new BusinessException("保单尚未生效");
        }

        if (policy.getExpiryDate() != null && policy.getExpiryDate().isBefore(today)) {
            throw new BusinessException(ResultCode.POLICY_EXPIRED);
        }

        log.info("保单校验通过: {} - {}", policyNo, policy.getProductName());
    }

    public boolean checkCoverageSufficient(String policyNo, BigDecimal claimAmount) {
        Policy policy = getPolicyByNo(policyNo);
        if (policy.getTotalCoverage() == null) {
            return true;
        }
        return policy.getTotalCoverage().compareTo(claimAmount) >= 0;
    }

    public BigDecimal calculateDeductible(String policyNo, BigDecimal lossAmount) {
        Policy policy = getPolicyByNo(policyNo);

        BigDecimal absoluteDeductible = policy.getDeductible() != null ? policy.getDeductible() : BigDecimal.ZERO;
        BigDecimal ratioDeductible = BigDecimal.ZERO;

        if (policy.getDeductibleRatio() != null && policy.getDeductibleRatio().compareTo(BigDecimal.ZERO) > 0) {
            ratioDeductible = lossAmount.multiply(policy.getDeductibleRatio())
                    .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        }

        BigDecimal actualDeductible = absoluteDeductible.max(ratioDeductible);
        log.debug("免赔额计算: 绝对免赔={}, 比例免赔={}, 实际免赔={}",
                absoluteDeductible, ratioDeductible, actualDeductible);

        return actualDeductible;
    }

    public void incrementClaimCount(Long policyId, BigDecimal claimAmount) {
        Policy policy = getPolicyById(policyId);
        int newClaimCount = (policy.getClaimCount() != null ? policy.getClaimCount() : 0) + 1;
        BigDecimal newTotalClaim = (policy.getTotalClaimAmount() != null ? policy.getTotalClaimAmount() : BigDecimal.ZERO)
                .add(claimAmount);

        policyMapper.updateClaimCount(policyId, newClaimCount, newTotalClaim);
        log.info("保单理赔次数更新: {} - 第{}次理赔, 累计赔付: {}", policy.getPolicyNo(), newClaimCount, newTotalClaim);
    }

    public List<Policy> getPoliciesByInsuredIdCard(String idCard) {
        return policyMapper.selectByInsuredIdCard(idCard);
    }

    public List<Policy> getPoliciesByVehiclePlateNo(String plateNo) {
        return policyMapper.selectByVehiclePlateNo(plateNo);
    }

    public int getClaimCountByPolicyNo(String policyNo) {
        Policy policy = getPolicyByNo(policyNo);
        return policy.getClaimCount() != null ? policy.getClaimCount() : 0;
    }
}
