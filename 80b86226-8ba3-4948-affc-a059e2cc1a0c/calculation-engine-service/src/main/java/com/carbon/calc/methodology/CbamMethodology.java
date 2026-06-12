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
import java.util.Set;

@Component
public class CbamMethodology implements AccountingMethodology {

    private static final Set<String> CBAM_SCOPED_TYPES = Set.of(
            "FUEL_COMBUSTION",
            "RAW_MATERIAL",
            "PROCESS_EMISSION",
            "PURCHASED_ELECTRICITY"
    );

    private static final Set<String> CBAM_GASES = Set.of(
            "CO2", "CH4", "N2O"
    );

    @Override
    public AccountingStandard getStandard() {
        return AccountingStandard.CBAM;
    }

    @Override
    public FactorLibrary defaultFactorLibrary() {
        return FactorLibrary.CBAM_2024;
    }

    @Override
    public Optional<String> resolveFactorMatchKey(CalcContext ctx) {
        if (!CBAM_SCOPED_TYPES.contains(ctx.activityDataType())) {
            return Optional.empty();
        }
        if (ctx.factorMatchKey() != null && !ctx.factorMatchKey().isEmpty()) {
            return Optional.of("CBAM-" + ctx.factorMatchKey());
        }
        return Optional.empty();
    }

    @Override
    public CalculationResult calculate(CalcContext ctx, FactorSnapshot factor) {
        GreenhouseGas gas = factor != null && CBAM_GASES.contains(factor.gas().name())
                ? factor.gas() : (ctx.gasOverride() != null ? ctx.gasOverride() : GreenhouseGas.CO2);
        if (!CBAM_GASES.contains(gas.name())) {
            return null;
        }

        Map<String, Object> params = new LinkedHashMap<>();
        String formula;
        BigDecimal gasEmission;

        if (factor == null) {
            formula = "CBAM 默认因子法：活动数据 × 欧盟默认排放因子 (无匹配则0)";
            gasEmission = BigDecimal.ZERO;
        } else if ("PROCESS_EMISSION".equals(ctx.activityDataType())) {
            formula = "CBAM Annex II 工艺排放公式：E = Σ(原料量 × 排放因子 - 捕集封存减量)";
            params.put("processFactor", factor.value());
            params.put("annex", "II");
            gasEmission = ctx.activityValue().multiply(factor.value(), MathContext.DECIMAL64);
        } else if ("RAW_MATERIAL".equals(ctx.activityDataType())) {
            formula = "CBAM 原材料隐含碳：原料投入量(t) × 排放因子(tCO2e/t原料)";
            params.put("embeddedFactor", factor.value());
            gasEmission = ctx.activityValue().multiply(factor.value(), MathContext.DECIMAL64);
        } else {
            formula = factor.formula() != null ? factor.formula()
                    : "CBAM 过渡期报告公式：活动数据 × 排放因子 (Reg 2023/956)";
            params.put("factorValue", factor.value());
            params.put("regulation", "EU 2023/956");
            gasEmission = ctx.activityValue().multiply(factor.value(), MathContext.DECIMAL64);
        }

        if ("kg".equalsIgnoreCase(ctx.activityUnit())) {
            gasEmission = gasEmission.divide(BigDecimal.valueOf(1000), 10, RoundingMode.HALF_UP);
        }

        BigDecimal gwp = factor != null && factor.gwp() != null ? factor.gwp() : gas.getGwp100Ar6();
        params.put("activityValue", ctx.activityValue());
        params.put("activityUnit", ctx.activityUnit());
        params.put("gwp", gwp);
        params.put("reportingPhase", "过渡期 2024-2025");
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
                .qualityTag("CBAM_TRANSITION")
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
