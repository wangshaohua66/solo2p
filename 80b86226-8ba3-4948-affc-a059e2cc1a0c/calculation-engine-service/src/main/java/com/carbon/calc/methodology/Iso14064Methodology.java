package com.carbon.calc.methodology;

import com.carbon.common.enums.AccountingStandard;
import com.carbon.common.enums.FactorLibrary;
import com.carbon.common.enums.GreenhouseGas;
import com.carbon.common.enums.ScopeType;
import com.carbon.calc.entity.CalculationResult;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Component
public class Iso14064Methodology implements AccountingMethodology {

    @Override
    public AccountingStandard getStandard() {
        return AccountingStandard.ISO_14064_1;
    }

    @Override
    public FactorLibrary defaultFactorLibrary() {
        return FactorLibrary.IPCC_2019;
    }

    @Override
    public Optional<String> resolveFactorMatchKey(CalcContext ctx) {
        if (ctx.factorMatchKey() != null && !ctx.factorMatchKey().isEmpty()) {
            return Optional.of(ctx.factorMatchKey());
        }
        return ctx.candidateKeys() != null && !ctx.candidateKeys().isEmpty()
                ? Optional.of(ctx.candidateKeys().get(0)) : Optional.empty();
    }

    @Override
    public CalculationResult calculate(CalcContext ctx, FactorSnapshot factor) {
        GreenhouseGas gas = factor != null ? factor.gas() :
                (ctx.gasOverride() != null ? ctx.gasOverride() : GreenhouseGas.CO2);
        BigDecimal gasEmission;
        String formula;
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("activityValue", ctx.activityValue());
        params.put("activityUnit", ctx.activityUnit());

        BigDecimal ncv = ctx.netCalorificValue();
        BigDecimal cc = ctx.carbonContentOverride() != null
                ? ctx.carbonContentOverride() : (factor != null ? factor.carbonContent() : null);
        BigDecimal ox = ctx.oxidationRateOverride() != null
                ? ctx.oxidationRateOverride() : (factor != null ? factor.oxidationRate() : null);

        boolean isFuel = "FUEL_COMBUSTION".equals(ctx.activityDataType());
        if (isFuel && ncv != null && cc != null && ox != null) {
            formula = "E = 燃料量 × 净热值(NCV) × 碳含量(CC) × 氧化率(OxF) × 44/12";
            params.put("ncv", ncv);
            params.put("carbonContent", cc);
            params.put("oxidationRate", ox);
            params.put("co2cRatio", "44/12");
            gasEmission = ctx.activityValue()
                    .multiply(ncv, MathContext.DECIMAL64)
                    .multiply(cc, MathContext.DECIMAL64)
                    .multiply(ox, MathContext.DECIMAL64)
                    .multiply(BigDecimal.valueOf(44), MathContext.DECIMAL64)
                    .divide(BigDecimal.valueOf(12), 10, RoundingMode.HALF_UP);
        } else {
            formula = factor != null ? (factor.formula() != null ? factor.formula() : "E = 活动数据 × 排放因子")
                    : "E = 活动数据 × 默认因子";
            BigDecimal factorValue = factor != null ? factor.value() : BigDecimal.ZERO;
            params.put("factorValue", factorValue);
            params.put("factorUnit", factor != null ? factor.unit() : null);
            gasEmission = ctx.activityValue().multiply(factorValue, MathContext.DECIMAL64);
        }

        if ("kg".equalsIgnoreCase(ctx.activityUnit())) {
            gasEmission = gasEmission.divide(BigDecimal.valueOf(1000), 10, RoundingMode.HALF_UP);
        }

        BigDecimal gwp = factor != null && factor.gwp() != null ? factor.gwp() : gas.getGwp100Ar6();
        params.put("gwp", gwp);
        BigDecimal co2eq = applyGwp(gasEmission, gas);

        return CalculationResult.builder()
                .taskId(ctx.taskId())
                .periodYear(ctx.periodYear())
                .periodMonth(ctx.periodMonth())
                .period(ctx.period())
                .standard(getStandard())
                .sourceId(ctx.sourceId())
                .sourceCode(ctx.sourceCode())
                .sourceName(ctx.sourceName())
                .scope(resolveScope(ctx))
                .gas(gas)
                .activityValue(ctx.activityValue())
                .activityUnit(ctx.activityUnit())
                .factorValue(factor != null ? factor.value() : null)
                .factorUnit(factor != null ? factor.unit() : null)
                .factorLibrary(factor != null ? factor.library().name() : null)
                .factorVersion(factor != null ? factor.version() : null)
                .factorMatchKey(factor != null ? factor.matchKey() : null)
                .formula(formula)
                .formulaParams(params)
                .gasEmissionTons(gasEmission.setScale(8, RoundingMode.HALF_UP))
                .co2eqTons(co2eq.setScale(8, RoundingMode.HALF_UP))
                .gwpUsed(gwp)
                .oxidationRate(ox)
                .carbonContent(cc)
                .qualityTag(factor != null ? factor.tier() : "TIER1")
                .build();
    }

    private ScopeType resolveScope(CalcContext ctx) {
        try {
            return ScopeType.valueOf(ctx.scope());
        } catch (Exception e) {
            return ScopeType.SCOPE_1;
        }
    }
}
