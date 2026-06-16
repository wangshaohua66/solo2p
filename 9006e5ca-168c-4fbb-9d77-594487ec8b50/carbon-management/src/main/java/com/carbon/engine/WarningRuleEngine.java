package com.carbon.engine;

import com.carbon.entity.EmissionWarning;
import com.carbon.enums.WarningLevel;
import com.carbon.vo.emission.EmissionWarningVO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Slf4j
@Component
public class WarningRuleEngine {

    public EmissionWarningVO evaluate(Long enterpriseId, Integer year,
                                      BigDecimal cumulativeEmission, BigDecimal quotaTotal) {
        EmissionWarningVO vo = new EmissionWarningVO();
        vo.setEnterpriseId(enterpriseId);
        vo.setWarningYear(year);
        vo.setCumulativeEmission(cumulativeEmission);
        vo.setQuotaTotal(quotaTotal);

        if (quotaTotal == null || quotaTotal.compareTo(BigDecimal.ZERO) <= 0) {
            vo.setEmissionRatio(BigDecimal.ZERO);
            vo.setWarningLevel(WarningLevel.NORMAL.getCode());
            vo.setSellRestricted(false);
            return vo;
        }

        BigDecimal ratio = cumulativeEmission.divide(quotaTotal, 4, java.math.RoundingMode.HALF_UP);
        vo.setEmissionRatio(ratio);

        if (ratio.compareTo(new BigDecimal("0.9")) >= 0) {
            vo.setWarningLevel(WarningLevel.ALERT.getCode());
            vo.setSellRestricted(true);
            log.warn("企业[{}]年度[{}]排放达配额90%以上，告警并限制卖出", enterpriseId, year);
        } else if (ratio.compareTo(new BigDecimal("0.8")) >= 0) {
            vo.setWarningLevel(WarningLevel.WARNING.getCode());
            vo.setSellRestricted(false);
            log.warn("企业[{}]年度[{}]排放达配额80%，预警通知", enterpriseId, year);
        } else {
            vo.setWarningLevel(WarningLevel.NORMAL.getCode());
            vo.setSellRestricted(false);
        }

        return vo;
    }

    public boolean shouldRestrictSell(EmissionWarning warning) {
        return warning != null
                && WarningLevel.ALERT.getCode().equals(warning.getWarningLevel())
                && Boolean.TRUE.equals(warning.getSellRestricted());
    }
}
