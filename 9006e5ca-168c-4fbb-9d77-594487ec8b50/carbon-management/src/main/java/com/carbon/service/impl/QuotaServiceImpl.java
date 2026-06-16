package com.carbon.service.impl;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.carbon.common.constant.BizCode;
import com.carbon.common.exception.BizException;
import com.carbon.common.response.PageResult;
import com.carbon.dto.quota.*;
import com.carbon.entity.Baseline;
import com.carbon.entity.Enterprise;
import com.carbon.entity.Quota;
import com.carbon.enums.QuotaStatus;
import com.carbon.mapper.BaselineMapper;
import com.carbon.mapper.EnterpriseMapper;
import com.carbon.mapper.QuotaMapper;
import com.carbon.service.AuditService;
import com.carbon.service.QuotaService;
import com.carbon.vo.quota.QuotaVO;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuotaServiceImpl implements QuotaService {

    private final QuotaMapper quotaMapper;
    private final EnterpriseMapper enterpriseMapper;
    private final BaselineMapper baselineMapper;
    private final AuditService auditService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private static final String QUOTA_CACHE_PREFIX = "carbon:quota:";
    private static final long CACHE_TTL_HOURS = 24;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuotaVO allocate(QuotaAllocateDTO dto) {
        Enterprise enterprise = enterpriseMapper.selectById(dto.getEnterpriseId());
        if (enterprise == null) {
            throw new BizException(BizCode.ENTERPRISE_NOT_FOUND);
        }

        LambdaQueryWrapper<Quota> existsWrapper = new LambdaQueryWrapper<Quota>()
                .eq(Quota::getEnterpriseId, dto.getEnterpriseId())
                .eq(Quota::getQuotaYear, dto.getQuotaYear());
        if (quotaMapper.selectCount(existsWrapper) > 0) {
            throw new BizException(BizCode.QUOTA_YEAR_EXISTS);
        }

        Baseline baseline = baselineMapper.selectOne(new LambdaQueryWrapper<Baseline>()
                .eq(Baseline::getIndustryCode, enterprise.getIndustryCode())
                .eq(Baseline::getQuotaYear, dto.getQuotaYear()));
        if (baseline == null) {
            throw new BizException(BizCode.BASELINE_NOT_FOUND);
        }

        BigDecimal historicalEmission = dto.getHistoricalEmission();
        if (historicalEmission == null) {
            historicalEmission = BigDecimal.ZERO;
        }

        BigDecimal totalAmount = calculateQuotaAmount(baseline, historicalEmission);

        Quota quota = new Quota();
        quota.setEnterpriseId(dto.getEnterpriseId());
        quota.setEnterpriseCode(enterprise.getEnterpriseCode());
        quota.setQuotaYear(dto.getQuotaYear());
        quota.setTotalAmount(totalAmount);
        quota.setUsedAmount(BigDecimal.ZERO);
        quota.setFrozenAmount(BigDecimal.ZERO);
        quota.setAvailableAmount(totalAmount);
        quota.setStatus(QuotaStatus.PRE_ALLOCATED.getCode());
        quota.setHistoricalEmission(historicalEmission);
        quota.setBaselineValue(baseline.getBaselineValue());
        quota.setAllocateReason(dto.getAllocateReason());
        quota.setVersion(0);
        quotaMapper.insert(quota);

        auditChange(null, quota, "QUOTA_ALLOCATE", quota.getId(), dto.getEnterpriseId(), enterprise.getEnterpriseCode());

        cacheQuota(quota);
        return toVO(quota);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuotaVO issue(QuotaIssueDTO dto) {
        Quota before = quotaMapper.selectById(dto.getQuotaId());
        if (before == null) {
            throw new BizException(BizCode.QUOTA_NOT_FOUND);
        }
        if (!QuotaStatus.PRE_ALLOCATED.getCode().equals(before.getStatus())) {
            throw new BizException(BizCode.QUOTA_ALREADY_ISSUED);
        }

        Quota after = BeanUtil.copyProperties(before, Quota.class);
        after.setStatus(QuotaStatus.ISSUED.getCode());
        quotaMapper.updateById(after);

        auditChange(before, after, "QUOTA_ISSUE", after.getId(), after.getEnterpriseId(), after.getEnterpriseCode());

        evictQuotaCache(after);
        return toVO(after);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuotaVO adjust(QuotaAdjustDTO dto) {
        Quota before = quotaMapper.selectById(dto.getQuotaId());
        if (before == null) {
            throw new BizException(BizCode.QUOTA_NOT_FOUND);
        }
        if (QuotaStatus.PRE_ALLOCATED.getCode().equals(before.getStatus())) {
            throw new BizException(BizCode.QUOTA_STATUS_INVALID);
        }

        Quota after = BeanUtil.copyProperties(before, Quota.class);
        BigDecimal adjustAmount = dto.getAdjustAmount();

        if ("RECOVER".equals(dto.getAdjustType())) {
            if (before.getAvailableAmount().compareTo(adjustAmount) < 0) {
                throw new BizException(BizCode.QUOTA_INSUFFICIENT);
            }
            after.setTotalAmount(before.getTotalAmount().subtract(adjustAmount));
            after.setAvailableAmount(before.getAvailableAmount().subtract(adjustAmount));
        } else {
            after.setTotalAmount(before.getTotalAmount().add(adjustAmount));
            after.setAvailableAmount(before.getAvailableAmount().add(adjustAmount));
        }
        after.setStatus(QuotaStatus.ADJUSTED.getCode());
        quotaMapper.updateById(after);

        auditChange(before, after, "QUOTA_ADJUST", after.getId(), after.getEnterpriseId(), after.getEnterpriseCode());

        evictQuotaCache(after);
        return toVO(after);
    }

    @Override
    public QuotaVO getById(Long id) {
        Quota quota = quotaMapper.selectById(id);
        if (quota == null) {
            throw new BizException(BizCode.QUOTA_NOT_FOUND);
        }
        return toVO(quota);
    }

    @Override
    public PageResult<QuotaVO> page(QuotaQueryDTO dto) {
        LambdaQueryWrapper<Quota> wrapper = new LambdaQueryWrapper<Quota>()
                .eq(dto.getEnterpriseId() != null, Quota::getEnterpriseId, dto.getEnterpriseId())
                .eq(dto.getEnterpriseCode() != null, Quota::getEnterpriseCode, dto.getEnterpriseCode())
                .eq(dto.getQuotaYear() != null, Quota::getQuotaYear, dto.getQuotaYear())
                .eq(dto.getStatus() != null, Quota::getStatus, dto.getStatus())
                .orderByDesc(Quota::getCreatedTime);

        Page<Quota> page = quotaMapper.selectPage(new Page<>(dto.getPage(), dto.getSize()), wrapper);
        return new PageResult<>(page.getTotal(), (int) page.getCurrent(), (int) page.getSize(),
                page.getRecords().stream().map(this::toVO).toList());
    }

    private BigDecimal calculateQuotaAmount(Baseline baseline, BigDecimal historicalEmission) {
        BigDecimal baselineQuota = baseline.getBaselineValue().multiply(baseline.getAdjustCoefficient());
        if (historicalEmission.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal ratio = historicalEmission.divide(baseline.getBaselineValue(), 4, RoundingMode.HALF_UP);
            if (ratio.compareTo(BigDecimal.ONE) < 0) {
                return baselineQuota.multiply(ratio).setScale(2, RoundingMode.HALF_UP);
            }
        }
        return baselineQuota.setScale(2, RoundingMode.HALF_UP);
    }

    private void auditChange(Object before, Object after, String operation, Long bizId, Long enterpriseId, String enterpriseCode) {
        try {
            com.carbon.entity.AuditLog auditLog = new com.carbon.entity.AuditLog();
            auditLog.setBizType(operation);
            auditLog.setBizId(bizId);
            auditLog.setEnterpriseId(enterpriseId);
            auditLog.setEnterpriseCode(enterpriseCode);
            auditLog.setOperation(operation);
            auditLog.setOperator("SYSTEM");
            auditLog.setBeforeSnapshot(before != null ? objectMapper.writeValueAsString(before) : null);
            auditLog.setAfterSnapshot(after != null ? objectMapper.writeValueAsString(after) : null);
            auditService.log(auditLog);
        } catch (Exception e) {
            log.error("审计日志写入失败", e);
        }
    }

    private void cacheQuota(Quota quota) {
        try {
            String key = QUOTA_CACHE_PREFIX + quota.getId();
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(quota), CACHE_TTL_HOURS, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("配额缓存写入失败: {}", e.getMessage());
        }
    }

    private void evictQuotaCache(Quota quota) {
        try {
            redisTemplate.delete(QUOTA_CACHE_PREFIX + quota.getId());
        } catch (Exception e) {
            log.warn("配额缓存清除失败: {}", e.getMessage());
        }
    }

    private QuotaVO toVO(Quota quota) {
        return BeanUtil.copyProperties(quota, QuotaVO.class);
    }
}
