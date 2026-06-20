package com.tobacco.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.common.enums.CreditLevel;
import com.tobacco.common.enums.ViolationType;
import com.tobacco.common.exception.BusinessException;
import com.tobacco.common.result.PageResult;
import com.tobacco.entity.CreditRecord;
import com.tobacco.entity.Retailer;
import com.tobacco.entity.ViolationRecord;
import com.tobacco.mapper.CreditRecordMapper;
import com.tobacco.mapper.RetailerMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreditService {

    private final CreditRecordMapper creditRecordMapper;
    private final RetailerMapper retailerMapper;

    @Value("${credit.base-score}")
    private Integer baseScore;

    @Value("${credit.min-score}")
    private Integer minScore;

    @Value("${credit.max-score}")
    private Integer maxScore;

    @Value("${credit.repair-periods}")
    private Integer repairPeriods;

    @Transactional(rollbackFor = Exception.class)
    public void processViolation(ViolationRecord violationRecord) {
        Retailer retailer = retailerMapper.selectById(violationRecord.getRetailerId());
        if (retailer == null) {
            log.warn("零售户不存在，无法处理违规信用变更: {}", violationRecord.getRetailerId());
            return;
        }

        ViolationType violationType = ViolationType.getByCode(violationRecord.getViolationType());
        if (violationType == null) {
            return;
        }

        int operatingYearsBonus = calculateOperatingYearsBonus(retailer);
        int beforeScore = (retailer.getCreditScore() != null ? retailer.getCreditScore() : baseScore) + operatingYearsBonus;
        CreditLevel beforeLevel = CreditLevel.getByCode(retailer.getCreditLevel());
        if (beforeLevel == null) {
            beforeLevel = CreditLevel.B;
        }

        int deductPoints = violationType.getDeductPoints();
        int afterScore = Math.max(minScore, beforeScore - deductPoints - operatingYearsBonus);
        afterScore = Math.min(maxScore, afterScore);
        CreditLevel afterLevel = CreditLevel.getByScore(afterScore);

        retailer.setCreditScore(afterScore);
        retailer.setCreditLevel(afterLevel.getCode());
        retailer.setConsecutiveNoViolationPeriods(0);
        retailerMapper.updateById(retailer);

        CreditRecord record = new CreditRecord();
        record.setRecordNo(generateRecordNo());
        record.setRetailerId(retailer.getId());
        record.setRetailerName(retailer.getRetailerName());
        record.setLicenseNo(retailer.getLicenseNo());
        record.setChangeType("DEDUCT");
        record.setChangeReason(violationType.getName() + "违规扣分");
        record.setSourceId(violationRecord.getId());
        record.setSourceType("VIOLATION");
        record.setBeforeScore(beforeScore);
        record.setChangeScore(-deductPoints);
        record.setAfterScore(afterScore);
        record.setBeforeLevel(beforeLevel.getCode());
        record.setAfterLevel(afterLevel.getCode());
        record.setCountyId(retailer.getCountyId());
        record.setStationId(retailer.getStationId());
        creditRecordMapper.insert(record);

        if (beforeLevel.getRank() > afterLevel.getRank()) {
            log.info("信用降级触发，零售户：{}，等级从 {} 降至 {}",
                    retailer.getRetailerName(), beforeLevel.getCode(), afterLevel.getCode());
            triggerCreditDowngradeEffect(retailer, afterLevel);
        }

        log.info("违规信用扣分完成，零售户：{}，扣减：{}分，当前分数：{}，当前等级：{}",
                retailer.getRetailerName(), deductPoints, afterScore, afterLevel.getCode());
    }

    private int calculateOperatingYearsBonus(Retailer retailer) {
        if (retailer.getRegisterDate() == null) {
            return 0;
        }
        long years = ChronoUnit.YEARS.between(retailer.getRegisterDate(), LocalDate.now());
        if (years <= 0) return 0;
        if (years <= 1) return 2;
        if (years <= 3) return 4;
        if (years <= 5) return 6;
        if (years <= 10) return 8;
        return 10;
    }

    @Transactional(rollbackFor = Exception.class)
    public void triggerCreditDowngradeEffect(Retailer retailer, CreditLevel newLevel) {
        log.info("执行信用降级影响处理，零售户：{}，新等级：{}", retailer.getRetailerName(), newLevel.getCode());

        switch (newLevel) {
            case C, D -> {
                retailer.setInspectionFrequency(retailer.getInspectionFrequency() != null ? retailer.getInspectionFrequency() + 2 : 3);
                log.info("零售户 {} 信用降级至 {}，巡查频次增加至 {}", retailer.getRetailerName(), newLevel.getCode(), retailer.getInspectionFrequency());
            }
            case B -> {
                retailer.setInspectionFrequency(retailer.getInspectionFrequency() != null ? retailer.getInspectionFrequency() + 1 : 2);
                log.info("零售户 {} 信用降级至 {}，巡查频次增加至 {}", retailer.getRetailerName(), newLevel.getCode(), retailer.getInspectionFrequency());
            }
            default -> {
            }
        }

        BigDecimal originalCoefficient = CreditLevel.A.getCoefficient();
        BigDecimal newCoefficient = newLevel.getCoefficient();
        BigDecimal reductionRatio = originalCoefficient.subtract(newCoefficient)
                .divide(originalCoefficient, 4, RoundingMode.HALF_UP);
        if (reductionRatio.compareTo(BigDecimal.ZERO) > 0) {
            log.info("零售户 {} 信用降级至 {}，配额系数从 {} 降至 {}，缩减比例：{}%",
                    retailer.getRetailerName(), newLevel.getCode(),
                    originalCoefficient, newCoefficient,
                    reductionRatio.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP));
        }

        retailerMapper.updateById(retailer);
    }

    @Transactional(rollbackFor = Exception.class)
    public void processFulfillmentBonus(Long retailerId, double fulfillmentRate) {
        Retailer retailer = retailerMapper.selectById(retailerId);
        if (retailer == null) {
            return;
        }

        if (fulfillmentRate >= 0.95) {
            int beforeScore = retailer.getCreditScore() != null ? retailer.getCreditScore() : baseScore;
            CreditLevel beforeLevel = CreditLevel.getByCode(retailer.getCreditLevel());
            if (beforeLevel == null) beforeLevel = CreditLevel.B;

            int bonusPoints = 2;
            int afterScore = Math.min(maxScore, beforeScore + bonusPoints);
            CreditLevel afterLevel = CreditLevel.getByScore(afterScore);

            if (afterScore > beforeScore) {
                retailer.setCreditScore(afterScore);
                retailer.setCreditLevel(afterLevel.getCode());
                retailerMapper.updateById(retailer);

                CreditRecord record = new CreditRecord();
                record.setRecordNo(generateRecordNo());
                record.setRetailerId(retailerId);
                record.setRetailerName(retailer.getRetailerName());
                record.setLicenseNo(retailer.getLicenseNo());
                record.setChangeType("BONUS");
                record.setChangeReason("订货履约率达标奖励");
                record.setSourceType("FULFILLMENT");
                record.setBeforeScore(beforeScore);
                record.setChangeScore(bonusPoints);
                record.setAfterScore(afterScore);
                record.setBeforeLevel(beforeLevel.getCode());
                record.setAfterLevel(afterLevel.getCode());
                record.setCountyId(retailer.getCountyId());
                record.setStationId(retailer.getStationId());
                creditRecordMapper.insert(record);

                log.info("履约奖励加分，零售户：{}，加{}分，当前分数：{}",
                        retailer.getRetailerName(), bonusPoints, afterScore);
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void processPeriodEndCreditCheck() {
        java.util.List<Retailer> retailers = retailerMapper.selectList(null);

        for (Retailer retailer : retailers) {
            if (retailer.getStatus() == null || retailer.getStatus() != 1) {
                continue;
            }

            Integer consecutivePeriods = retailer.getConsecutiveNoViolationPeriods();
            if (consecutivePeriods == null) {
                consecutivePeriods = 0;
            }

            consecutivePeriods++;
            retailer.setConsecutiveNoViolationPeriods(consecutivePeriods);

            if (consecutivePeriods >= repairPeriods) {
                int beforeScore = retailer.getCreditScore() != null ? retailer.getCreditScore() : baseScore;
                CreditLevel beforeLevel = CreditLevel.getByCode(retailer.getCreditLevel());
                if (beforeLevel == null) beforeLevel = CreditLevel.B;

                if (beforeScore < baseScore) {
                    int repairPoints = 5;
                    int afterScore = Math.min(baseScore, beforeScore + repairPoints);
                    CreditLevel afterLevel = CreditLevel.getByScore(afterScore);

                    retailer.setCreditScore(afterScore);
                    retailer.setCreditLevel(afterLevel.getCode());

                    CreditRecord record = new CreditRecord();
                    record.setRecordNo(generateRecordNo());
                    record.setRetailerId(retailer.getId());
                    record.setRetailerName(retailer.getRetailerName());
                    record.setLicenseNo(retailer.getLicenseNo());
                    record.setChangeType("REPAIR");
                    record.setChangeReason("连续" + consecutivePeriods + "期无违规信用修复");
                    record.setSourceType("PERIOD_CHECK");
                    record.setBeforeScore(beforeScore);
                    record.setChangeScore(repairPoints);
                    record.setAfterScore(afterScore);
                    record.setBeforeLevel(beforeLevel.getCode());
                    record.setAfterLevel(afterLevel.getCode());
                    record.setCountyId(retailer.getCountyId());
                    record.setStationId(retailer.getStationId());
                    creditRecordMapper.insert(record);

                    log.info("信用修复加分，零售户：{}，加{}分，当前分数：{}",
                            retailer.getRetailerName(), repairPoints, afterScore);
                }
            }

            retailerMapper.updateById(retailer);
        }
    }

    public CreditLevel getCreditLevel(Long retailerId) {
        Retailer retailer = retailerMapper.selectById(retailerId);
        if (retailer == null) {
            throw new BusinessException("零售户不存在");
        }
        return CreditLevel.getByCode(retailer.getCreditLevel());
    }

    public Integer getCreditScore(Long retailerId) {
        Retailer retailer = retailerMapper.selectById(retailerId);
        if (retailer == null) {
            throw new BusinessException("零售户不存在");
        }
        return retailer.getCreditScore();
    }

    public PageResult<CreditRecord> getCreditRecordPage(Long retailerId, Long countyId, Long stationId,
                                                        String changeType, Integer pageNum, Integer pageSize) {
        Page<CreditRecord> page = new Page<>(pageNum, pageSize);
        IPage<CreditRecord> result = creditRecordMapper.selectPageByCondition(
                page, retailerId, countyId, stationId, changeType);
        return PageResult.of(result.getTotal(), result.getPages(), result.getRecords());
    }

    public java.util.List<CreditRecord> getCreditRecordsByRetailer(Long retailerId) {
        return creditRecordMapper.selectByRetailerId(retailerId);
    }

    public BigDecimal getCreditCoefficient(Long retailerId) {
        CreditLevel level = getCreditLevel(retailerId);
        return level.getCoefficient();
    }

    private String generateRecordNo() {
        return "CR" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) +
                IdUtil.getSnowflakeNextIdStr().substring(0, 4);
    }
}
