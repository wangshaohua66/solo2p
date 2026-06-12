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
public class GhgProtocolMethodology implements AccountingMethodology {

    @Override
    public AccountingStandard getStandard() {
        return AccountingStandard.GHG_PROTOCOL;
    }

    @Override
    public FactorLibrary defaultFactorLibrary() {
        return FactorLibrary.GHG_PROTOCOL;
    }

    @Override
    public Optional<String> resolveFactorMatchKey(CalcContext ctx) {
        if (ctx.factorMatchKey() != null && !ctx.factorMatchKey().isEmpty()) {
            return Optional.of("GHG-" + ctx.factorMatchKey());
        }
        return Optional.empty();
    }

    @Override
    public CalculationResult calculate(CalcContext ctx, FactorSnapshot factor) {
        GreenhouseGas gas = factor != null ? factor.gas() :
                (ctx.gasOverride() != null ? ctx.gasOverride() : GreenhouseGas.CO2);
        Map<String, Object> params = new LinkedHashMap<>();
        String formula;
        BigDecimal gasEmission;

        String activityType = ctx.activityDataType();
        boolean isPurchasedElectricity = "PURCHASED_ELECTRICITY".equals(activityType);
        boolean isPurchasedHeat = "PURCHASED_HEAT".equals(activityType) || "PURCHASED_STEAM".equals(activityType);

        if (isPurchasedElectricity && factor != null) {
            formula = "Scope2 市场法: E = 购入电力(MWh) × 电网排放因子(tCO2e/MWh)";
            params.put("method", "location-based");
            params.put("gridFactor", factor.value());
            gasEmission = ctx.activityValue().multiply(factor.value(), MathContext.DECIMAL64);
        } else if (isPurchasedHeat && factor != null) {
            formula = "Scope2: E = 购入热力(GJ) × 热力排放因子(tCO2e/GJ)";
            params.put("heatFactor", factor.value());
            gasEmission = ctx.activityValue().multiply(factor.value(), MathContext.DECIMAL64);
        } else if (factor != null) {
            formula = factor.formula() != null ? factor.formula() :
                    "E = 活动数据 × 排放因子 (GHG Protocol WRI/WBCSD)";
            params.put("factorValue", factor.value());
            params.put("factorUnit", factor.unit());
            gasEmission = ctx.activityValue().multiply(factor.value(), MathContext.DECIMAL64);
        } else {
            formula = "E = 活动数据 × 默认因子 (无因子匹配, Tier 1)";
            gasEmission = ctx.activityValue().multiply(BigDecimal.ZERO);
        }

        if ("kg".equalsIgnoreCase(ctx.activityUnit())) {
            gasEmission = gasEmission.divide(BigDecimal.valueOf(1000), 10, RoundingMode.HALF_UP);
        }

        BigDecimal gwp = factor != null && factor.gwp() != null ? factor.gwp() : gas.getGwp100Ar6();
        params.put("activityValue", ctx.activityValue());
        params.put("activityUnit", ctx.activityUnit());
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
                .qualityTag(factor != null ? "GHG_PROTOCOL_COMPLIANT" : "TIER1_DEFAULT")
                .build();
    }

    private ScopeType resolveScope(CalcContext ctx) {
        try {
            return ScopeType.valueOf(ctx.scope());
        } catch (Exception e) {
            if ("PURCHASED_ELECTRICITY".equals(ctx.activityDataType())
                    || "PURCHASED_HEAT".equals(ctx.activityDataType())
                    || "PURCHASED_STEAM".equals(ctx.activityDataType())) {
                return ScopeType.SCOPE_2;
            }
            return ScopeType.SCOPE_1;
        }
    }
}
