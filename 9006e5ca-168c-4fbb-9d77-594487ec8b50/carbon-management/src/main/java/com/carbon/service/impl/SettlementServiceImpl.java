package com.carbon.service.impl;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.carbon.common.constant.BizCode;
import com.carbon.common.exception.BizException;
import com.carbon.common.response.PageResult;
import com.carbon.dto.settlement.*;
import com.carbon.entity.EmissionReport;
import com.carbon.entity.Quota;
import com.carbon.entity.Settlement;
import com.carbon.enums.EmissionStatus;
import com.carbon.enums.QuotaStatus;
import com.carbon.enums.SettlementStatus;
import com.carbon.mapper.EmissionReportMapper;
import com.carbon.mapper.QuotaMapper;
import com.carbon.mapper.SettlementMapper;
import com.carbon.service.AuditService;
import com.carbon.service.SettlementService;
import com.carbon.vo.settlement.SettlementVO;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class SettlementServiceImpl implements SettlementService {

    private final SettlementMapper settlementMapper;
    private final QuotaMapper quotaMapper;
    private final EmissionReportMapper emissionReportMapper;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    private static final BigDecimal PENALTY_RATE_L1 = new BigDecimal("3");
    private static final BigDecimal PENALTY_RATE_L2 = new BigDecimal("5");
    private static final BigDecimal PENALTY_RATE_L3 = new BigDecimal("10");
    private static final BigDecimal DEFICIT_THRESHOLD_L1 = new BigDecimal("0.1");
    private static final BigDecimal DEFICIT_THRESHOLD_L2 = new BigDecimal("0.2");
    private static final BigDecimal DEFICIT_THRESHOLD_L3 = new BigDecimal("0.3");

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SettlementVO clear(SettlementClearDTO dto) {
        Settlement existing = settlementMapper.selectOne(new LambdaQueryWrapper<Settlement>()
                .eq(Settlement::getEnterpriseId, dto.getEnterpriseId())
                .eq(Settlement::getSettlementYear, dto.getSettlementYear()));
        if (existing != null && !SettlementStatus.PENDING.getCode().equals(existing.getStatus())) {
            throw new BizException(BizCode.SETTLEMENT_ALREADY_CLEARED);
        }

        Quota quota = quotaMapper.selectOne(new LambdaQueryWrapper<Quota>()
                .eq(Quota::getEnterpriseId, dto.getEnterpriseId())
                .eq(Quota::getQuotaYear, dto.getSettlementYear()));
        if (quota == null) {
            throw new BizException(BizCode.QUOTA_NOT_FOUND);
        }

        BigDecimal actualEmission = emissionReportMapper.sumEmissionByEnterpriseAndYear(
                dto.getEnterpriseId(), dto.getSettlementYear());

        BigDecimal quotaBalance = quota.getAvailableAmount();
        BigDecimal deficit = BigDecimal.ZERO;
        BigDecimal surplus = BigDecimal.ZERO;

        if (actualEmission.compareTo(quotaBalance) > 0) {
            deficit = actualEmission.subtract(quotaBalance);
        } else {
            surplus = quotaBalance.subtract(actualEmission);
        }

        Settlement settlement = new Settlement();
        settlement.setEnterpriseId(dto.getEnterpriseId());
        settlement.setSettlementYear(dto.getSettlementYear());
        settlement.setQuotaBalance(quotaBalance);
        settlement.setActualEmission(actualEmission);
        settlement.setDeficit(deficit);
        settlement.setSurplus(surplus);
        settlement.setOperator("SYSTEM");

        if (deficit.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal penaltyAmount = calculatePenalty(deficit, quotaBalance);
            String penaltyRule = determinePenaltyRule(deficit, quotaBalance);
            settlement.setPenaltyAmount(penaltyAmount);
            settlement.setPenaltyRule(penaltyRule);
            settlement.setStatus(SettlementStatus.PENALTY.getCode());
            settlement.setInstallmentAllowed(deficit.compareTo(new BigDecimal("1000")) > 0);
        } else {
            settlement.setPenaltyAmount(BigDecimal.ZERO);
            settlement.setStatus(SettlementStatus.CLEARED.getCode());
        }

        settlement.setSettledTime(LocalDateTime.now());
        settlementMapper.insert(settlement);

        auditLog("SETTLEMENT_CLEAR", settlement.getId(), dto.getEnterpriseId(), null, settlement);
        return toVO(settlement);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SettlementVO applyInstallment(SettlementInstallmentDTO dto) {
        Settlement settlement = settlementMapper.selectById(dto.getSettlementId());
        if (settlement == null) {
            throw new BizException(BizCode.SETTLEMENT_NOT_FOUND);
        }
        if (!SettlementStatus.PENALTY.getCode().equals(settlement.getStatus())) {
            throw new BizException(BizCode.SETTLEMENT_PENALTY_PENDING);
        }
        if (!Boolean.TRUE.equals(settlement.getInstallmentAllowed())) {
            throw new BizException(BizCode.SETTLEMENT_INSTALLMENT_REJECTED);
        }

        Settlement before = BeanUtil.copyProperties(settlement, Settlement.class);

        settlement.setStatus(SettlementStatus.INSTALLMENT.getCode());
        settlement.setInstallmentPeriods(dto.getInstallmentPeriods());
        settlement.setInstallmentPaid(BigDecimal.ZERO);
        settlementMapper.updateById(settlement);

        auditLog("SETTLEMENT_PENALTY", settlement.getId(), settlement.getEnterpriseId(), before, settlement);
        return toVO(settlement);
    }

    @Override
    public SettlementVO getById(Long id) {
        Settlement settlement = settlementMapper.selectById(id);
        if (settlement == null) {
            throw new BizException(BizCode.SETTLEMENT_NOT_FOUND);
        }
        return toVO(settlement);
    }

    @Override
    public PageResult<SettlementVO> page(SettlementQueryDTO dto) {
        LambdaQueryWrapper<Settlement> wrapper = new LambdaQueryWrapper<Settlement>()
                .eq(dto.getEnterpriseId() != null, Settlement::getEnterpriseId, dto.getEnterpriseId())
                .eq(dto.getEnterpriseCode() != null, Settlement::getEnterpriseCode, dto.getEnterpriseCode())
                .eq(dto.getSettlementYear() != null, Settlement::getSettlementYear, dto.getSettlementYear())
                .eq(dto.getStatus() != null, Settlement::getStatus, dto.getStatus())
                .orderByDesc(Settlement::getCreatedTime);

        Page<Settlement> page = settlementMapper.selectPage(new Page<>(dto.getPage(), dto.getSize()), wrapper);
        return new PageResult<>(page.getTotal(), (int) page.getCurrent(), (int) page.getSize(),
                page.getRecords().stream().map(this::toVO).toList());
    }

    private BigDecimal calculatePenalty(BigDecimal deficit, BigDecimal quotaBalance) {
        BigDecimal deficitRatio = deficit.divide(quotaBalance, 4, RoundingMode.HALF_UP);

        if (deficitRatio.compareTo(DEFICIT_THRESHOLD_L3) >= 0) {
            return deficit.multiply(PENALTY_RATE_L3).setScale(2, RoundingMode.HALF_UP);
        } else if (deficitRatio.compareTo(DEFICIT_THRESHOLD_L2) >= 0) {
            return deficit.multiply(PENALTY_RATE_L2).setScale(2, RoundingMode.HALF_UP);
        } else if (deficitRatio.compareTo(DEFICIT_THRESHOLD_L1) >= 0) {
            return deficit.multiply(PENALTY_RATE_L1).setScale(2, RoundingMode.HALF_UP);
        } else {
            return deficit.multiply(PENALTY_RATE_L1).setScale(2, RoundingMode.HALF_UP);
        }
    }

    private String determinePenaltyRule(BigDecimal deficit, BigDecimal quotaBalance) {
        BigDecimal deficitRatio = deficit.divide(quotaBalance, 4, RoundingMode.HALF_UP);

        if (deficitRatio.compareTo(DEFICIT_THRESHOLD_L3) >= 0) {
            return "超排30%以上，罚则3倍(10元/吨)";
        } else if (deficitRatio.compareTo(DEFICIT_THRESHOLD_L2) >= 0) {
            return "超排20%-30%，罚则2倍(5元/吨)";
        } else if (deficitRatio.compareTo(DEFICIT_THRESHOLD_L1) >= 0) {
            return "超排10%-20%，罚则1.5倍(3元/吨)";
        } else {
            return "超排10%以内，罚则1倍(3元/吨)";
        }
    }

    private void auditLog(String operation, Long bizId, Long enterpriseId, Object before, Object after) {
        try {
            com.carbon.entity.AuditLog auditLog = new com.carbon.entity.AuditLog();
            auditLog.setBizType(operation);
            auditLog.setBizId(bizId);
            auditLog.setEnterpriseId(enterpriseId);
            auditLog.setOperation(operation);
            auditLog.setOperator("SYSTEM");
            auditLog.setBeforeSnapshot(before != null ? objectMapper.writeValueAsString(before) : null);
            auditLog.setAfterSnapshot(after != null ? objectMapper.writeValueAsString(after) : null);
            auditService.log(auditLog);
        } catch (Exception e) {
            log.error("审计日志写入失败", e);
        }
    }

    private SettlementVO toVO(Settlement settlement) {
        return BeanUtil.copyProperties(settlement, SettlementVO.class);
    }
}
