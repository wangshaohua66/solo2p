package com.carbon.service.impl;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.carbon.common.constant.BizCode;
import com.carbon.common.exception.BizException;
import com.carbon.common.response.PageResult;
import com.carbon.dto.emission.*;
import com.carbon.entity.EmissionReport;
import com.carbon.entity.EmissionWarning;
import com.carbon.entity.Enterprise;
import com.carbon.entity.Quota;
import com.carbon.enums.EmissionStatus;
import com.carbon.enums.QuotaStatus;
import com.carbon.enums.WarningLevel;
import com.carbon.mapper.EmissionReportMapper;
import com.carbon.mapper.EmissionWarningMapper;
import com.carbon.mapper.EnterpriseMapper;
import com.carbon.mapper.QuotaMapper;
import com.carbon.service.AuditService;
import com.carbon.service.EmissionService;
import com.carbon.vo.emission.EmissionReportVO;
import com.carbon.vo.emission.EmissionWarningVO;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmissionServiceImpl implements EmissionService {

    private final EmissionReportMapper emissionReportMapper;
    private final EmissionWarningMapper emissionWarningMapper;
    private final EnterpriseMapper enterpriseMapper;
    private final QuotaMapper quotaMapper;
    private final AuditService auditService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private static final String WARNING_CACHE_PREFIX = "carbon:warning:";
    private static final int BATCH_SIZE = 1000;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public EmissionReportVO report(EmissionReportDTO dto) {
        Enterprise enterprise = enterpriseMapper.selectById(dto.getEnterpriseId());
        if (enterprise == null) {
            throw new BizException(BizCode.ENTERPRISE_NOT_FOUND);
        }

        EmissionReport report = BeanUtil.copyProperties(dto, EmissionReport.class);
        report.setEnterpriseCode(enterprise.getEnterpriseCode());

        boolean isAnomaly = validateEmissionData(dto);
        report.setStatus(isAnomaly ? EmissionStatus.ANOMALY.getCode() : EmissionStatus.PENDING.getCode());

        emissionReportMapper.insert(report);

        auditLog("EMISSION_REPORT", report.getId(), dto.getEnterpriseId(), enterprise.getEnterpriseCode(), null, report);

        updateWarningStatus(dto.getEnterpriseId(), dto.getReportYear());
        return toVO(report);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<EmissionReportVO> batchImport(List<EmissionReportDTO> dtoList) {
        if (dtoList.size() > 100000) {
            throw new BizException(BizCode.PARAM_INVALID.getCode(), "单次导入不超过10万条");
        }

        List<EmissionReport> reports = dtoList.stream().map(dto -> {
            Enterprise enterprise = enterpriseMapper.selectById(dto.getEnterpriseId());
            if (enterprise == null) {
                throw new BizException(BizCode.ENTERPRISE_NOT_FOUND);
            }
            EmissionReport report = BeanUtil.copyProperties(dto, EmissionReport.class);
            report.setEnterpriseCode(enterprise.getEnterpriseCode());
            boolean isAnomaly = validateEmissionData(dto);
            report.setStatus(isAnomaly ? EmissionStatus.ANOMALY.getCode() : EmissionStatus.PENDING.getCode());
            return report;
        }).toList();

        for (int i = 0; i < reports.size(); i += BATCH_SIZE) {
            List<EmissionReport> batch = reports.subList(i, Math.min(i + BATCH_SIZE, reports.size()));
            emissionReportMapper.batchInsert(batch);
        }

        return reports.stream().map(this::toVO).toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public EmissionReportVO verify(EmissionVerifyDTO dto) {
        EmissionReport before = emissionReportMapper.selectById(dto.getReportId());
        if (before == null) {
            throw new BizException(BizCode.EMISSION_NOT_FOUND);
        }
        if (EmissionStatus.VERIFIED.getCode().equals(before.getStatus())) {
            throw new BizException(BizCode.EMISSION_ALREADY_VERIFIED);
        }

        EmissionReport after = BeanUtil.copyProperties(before, EmissionReport.class);
        after.setStatus(dto.getVerifyResult());
        after.setVerifyRemark(dto.getVerifyRemark());
        after.setVerifier("SYSTEM");
        after.setVerifyTime(LocalDateTime.now());
        emissionReportMapper.updateById(after);

        auditLog("EMISSION_VERIFY", after.getId(), after.getEnterpriseId(), after.getEnterpriseCode(), before, after);
        return toVO(after);
    }

    @Override
    public EmissionReportVO getById(Long id) {
        EmissionReport report = emissionReportMapper.selectById(id);
        if (report == null) {
            throw new BizException(BizCode.EMISSION_NOT_FOUND);
        }
        return toVO(report);
    }

    @Override
    public PageResult<EmissionReportVO> page(EmissionQueryDTO dto) {
        LambdaQueryWrapper<EmissionReport> wrapper = new LambdaQueryWrapper<EmissionReport>()
                .eq(dto.getEnterpriseId() != null, EmissionReport::getEnterpriseId, dto.getEnterpriseId())
                .eq(dto.getEnterpriseCode() != null, EmissionReport::getEnterpriseCode, dto.getEnterpriseCode())
                .eq(dto.getReportYear() != null, EmissionReport::getReportYear, dto.getReportYear())
                .eq(dto.getReportMonth() != null, EmissionReport::getReportMonth, dto.getReportMonth())
                .eq(dto.getStatus() != null, EmissionReport::getStatus, dto.getStatus())
                .orderByDesc(EmissionReport::getCreatedTime);

        Page<EmissionReport> page = emissionReportMapper.selectPage(new Page<>(dto.getPage(), dto.getSize()), wrapper);
        return new PageResult<>(page.getTotal(), (int) page.getCurrent(), (int) page.getSize(),
                page.getRecords().stream().map(this::toVO).toList());
    }

    @Override
    public EmissionWarningVO checkWarning(Long enterpriseId, Integer year) {
        BigDecimal cumulativeEmission = emissionReportMapper.sumEmissionByEnterpriseAndYear(enterpriseId, year);

        Quota quota = quotaMapper.selectOne(new LambdaQueryWrapper<Quota>()
                .eq(Quota::getEnterpriseId, enterpriseId)
                .eq(Quota::getQuotaYear, year)
                .eq(Quota::getStatus, QuotaStatus.ISSUED.getCode()));

        EmissionWarningVO vo = new EmissionWarningVO();
        vo.setEnterpriseId(enterpriseId);
        vo.setWarningYear(year);

        if (quota != null && quota.getTotalAmount().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal ratio = cumulativeEmission.divide(quota.getTotalAmount(), 4, RoundingMode.HALF_UP);
            vo.setCumulativeEmission(cumulativeEmission);
            vo.setQuotaTotal(quota.getTotalAmount());
            vo.setEmissionRatio(ratio);

            if (ratio.compareTo(new BigDecimal("0.9")) >= 0) {
                vo.setWarningLevel(WarningLevel.ALERT.getCode());
                vo.setSellRestricted(true);
            } else if (ratio.compareTo(new BigDecimal("0.8")) >= 0) {
                vo.setWarningLevel(WarningLevel.WARNING.getCode());
                vo.setSellRestricted(false);
            } else {
                vo.setWarningLevel(WarningLevel.NORMAL.getCode());
                vo.setSellRestricted(false);
            }
        } else {
            vo.setCumulativeEmission(cumulativeEmission);
            vo.setQuotaTotal(BigDecimal.ZERO);
            vo.setEmissionRatio(BigDecimal.ZERO);
            vo.setWarningLevel(WarningLevel.NORMAL.getCode());
            vo.setSellRestricted(false);
        }
        return vo;
    }

    private boolean validateEmissionData(EmissionReportDTO dto) {
        boolean anomaly = false;

        if (dto.getEmissionAmount().compareTo(BigDecimal.ZERO) <= 0) {
            anomaly = true;
        }

        BigDecimal sumComponents = BigDecimal.ZERO;
        if (dto.getCo2Amount() != null) sumComponents = sumComponents.add(dto.getCo2Amount());
        if (dto.getCh4Amount() != null) sumComponents = sumComponents.add(dto.getCh4Amount());
        if (dto.getN2oAmount() != null) sumComponents = sumComponents.add(dto.getN2oAmount());

        if (sumComponents.compareTo(BigDecimal.ZERO) > 0
                && dto.getEmissionAmount().compareTo(sumComponents) < 0) {
            anomaly = true;
        }

        if (dto.getFuelConsumption() != null && dto.getFuelConsumption().compareTo(BigDecimal.ZERO) < 0) {
            anomaly = true;
        }
        if (dto.getPowerConsumption() != null && dto.getPowerConsumption().compareTo(BigDecimal.ZERO) < 0) {
            anomaly = true;
        }
        if (dto.getHeatConsumption() != null && dto.getHeatConsumption().compareTo(BigDecimal.ZERO) < 0) {
            anomaly = true;
        }

        return anomaly;
    }

    private void updateWarningStatus(Long enterpriseId, Integer year) {
        EmissionWarningVO warningVO = checkWarning(enterpriseId, year);

        EmissionWarning warning = new EmissionWarning();
        warning.setEnterpriseId(enterpriseId);
        warning.setWarningYear(year);
        warning.setCumulativeEmission(warningVO.getCumulativeEmission());
        warning.setQuotaTotal(warningVO.getQuotaTotal());
        warning.setEmissionRatio(warningVO.getEmissionRatio());
        warning.setWarningLevel(warningVO.getWarningLevel());
        warning.setSellRestricted(warningVO.getSellRestricted());
        warning.setNotifyStatus("NOTIFIED");

        EmissionWarning existing = emissionWarningMapper.selectOne(new LambdaQueryWrapper<EmissionWarning>()
                .eq(EmissionWarning::getEnterpriseId, enterpriseId)
                .eq(EmissionWarning::getWarningYear, year));

        if (existing != null) {
            warning.setId(existing.getId());
            emissionWarningMapper.updateById(warning);
        } else {
            emissionWarningMapper.insert(warning);
        }

        try {
            String key = WARNING_CACHE_PREFIX + enterpriseId + ":" + year;
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(warningVO));
        } catch (Exception e) {
            log.warn("预警缓存写入失败: {}", e.getMessage());
        }
    }

    private void auditLog(String operation, Long bizId, Long enterpriseId, String enterpriseCode, Object before, Object after) {
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

    private EmissionReportVO toVO(EmissionReport report) {
        return BeanUtil.copyProperties(report, EmissionReportVO.class);
    }
}
