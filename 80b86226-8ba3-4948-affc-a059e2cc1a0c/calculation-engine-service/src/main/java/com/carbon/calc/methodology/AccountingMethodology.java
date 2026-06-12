package com.carbon.calc.methodology;

import com.carbon.common.enums.AccountingStandard;
import com.carbon.common.enums.FactorLibrary;
import com.carbon.common.enums.GreenhouseGas;
import com.carbon.calc.entity.CalculationResult;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface AccountingMethodology {

    AccountingStandard getStandard();

    FactorLibrary defaultFactorLibrary();

    Optional<String> resolveFactorMatchKey(CalcContext ctx);

    CalculationResult calculate(CalcContext ctx, FactorSnapshot factor);

    default BigDecimal applyGwp(BigDecimal gasEmission, GreenhouseGas gas) {
        if (gasEmission == null) return BigDecimal.ZERO;
        return gasEmission.multiply(gas.getGwp100Ar6());
    }

    record FactorSnapshot(
            String matchKey,
            FactorLibrary library,
            String version,
            BigDecimal value,
            String unit,
            BigDecimal carbonContent,
            BigDecimal oxidationRate,
            BigDecimal gwp,
            GreenhouseGas gas,
            String formula,
            String tier
    ) {}

    record CalcContext(
            String tenantId,
            String taskId,
            Integer periodYear,
            Integer periodMonth,
            String period,
            String sourceId,
            String sourceCode,
            String sourceName,
            String scope,
            String activityDataType,
            BigDecimal activityValue,
            String activityUnit,
            BigDecimal rawValue,
            BigDecimal netCalorificValue,
            BigDecimal carbonContentOverride,
            BigDecimal oxidationRateOverride,
            String factorMatchKey,
            List<String> candidateKeys,
            GreenhouseGas gasOverride
    ) {}
}
