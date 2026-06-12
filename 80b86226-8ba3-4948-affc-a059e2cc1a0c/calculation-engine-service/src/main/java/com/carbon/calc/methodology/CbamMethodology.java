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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Component
public class CbamMethodology implements AccountingMethodology {

    private static final Set<String> CBAM_SCOPED_TYPES = Set.of(
            "FUEL_COMBUSTION",
            "RAW_MATERIAL",
            "PROCESS_EMISSION",
            "PURCHASED_ELECTRICITY",
            "STEAM_IMPORT",
            "HYDROGEN_IMPORT",
            "WASTE_DISPOSAL"
    );

    private static final List<GreenhouseGas> CBAM_GASES = List.of(
            GreenhouseGas.CO2,
            GreenhouseGas.CH4,
            GreenhouseGas.N2O,
            GreenhouseGas.HFC_23,
            GreenhouseGas.PFC_CF4,
            GreenhouseGas.SF6,
            GreenhouseGas.NF3
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
        if (factor != null && CBAM_GASES.contains(factor.gas())) {
            return calcSingleGas(ctx, factor, factor.gas());
        }
        return null;
    }

    public List<CalculationResult> calculateAllGases(CalcContext ctx,
                                                      Map<GreenhouseGas, FactorSnapshot> gasFactors) {
        List<CalculationResult> results = new ArrayList<>();
        for (GreenhouseGas gas : CBAM_GASES) {
            FactorSnapshot gasFactor = gasFactors.get(gas);
            if (gasFactor != null) {
                CalculationResult r = calcSingleGas(ctx, gasFactor, gas);
                if (r != null) results.add(r);
            }
        }
        return results;
    }

    private CalculationResult calcSingleGas(CalcContext ctx,
                                            FactorSnapshot factor,
                                            GreenhouseGas gas) {
        if (!CBAM_GASES.contains(gas)) {
            return null;
        }

        Map<String, Object> params = new LinkedHashMap<>();
        String formula;
        BigDecimal gasEmission;

        if (factor == null) {
            formula = "CBAM 隐含碳默认因子法：活动数据 × 欧盟默认排放因子 (无匹配则0)";
            gasEmission = BigDecimal.ZERO;
        } else if ("PROCESS_EMISSION".equals(ctx.activityDataType())) {
            formula = String.format(
                    "CBAM Annex II 工艺排放公式 [%s]：E = Σ(原料量 × %s排放因子 - 捕集封存减量)",
                    gas.name(), gas.name());
            params.put("processFactor", factor.value());
            params.put("annex", "II");
            params.put("gas", gas.name());
            gasEmission = ctx.activityValue().multiply(factor.value(), MathContext.DECIMAL64);
        } else if ("RAW_MATERIAL".equals(ctx.activityDataType())) {
            formula = String.format(
                    "CBAM 原材料隐含碳 [%s]：原料投入量(t) × %s排放因子(tCO2e/t原料)",
                    gas.name(), gas.name());
            params.put("embeddedFactor", factor.value());
            params.put("gas", gas.name());
            gasEmission = ctx.activityValue().multiply(factor.value(), MathContext.DECIMAL64);
        } else if ("PURCHASED_ELECTRICITY".equals(ctx.activityDataType())) {
            formula = String.format(
                    "CBAM 购入电力隐含碳 [%s]：电力购入量(MWh) × 电网排放因子(tCO2e/MWh)",
                    gas.name());
            params.put("gridFactor", factor.value());
            params.put("gas", gas.name());
            gasEmission = ctx.activityValue().multiply(factor.value(), MathContext.DECIMAL64);
        } else {
            formula = factor.formula() != null ? factor.formula()
                    : String.format("CBAM 过渡期报告公式 [%s]：活动数据 × 排放因子 (Reg 2023/956)", gas.name());
            params.put("factorValue", factor.value());
            params.put("regulation", "EU 2023/956");
            params.put("gas", gas.name());
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
        params.put("methodology", "CBAM Regulation (EU) 2023/956");
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
                .gasEmissionTons(gasEmission.setScale(10, RoundingMode.HALF_UP))
                .co2eqTons(co2eq.setScale(10, RoundingMode.HALF_UP))
                .gwpUsed(gwp)
                .qualityTag("CBAM_TRANSITION_" + gas.name())
                .build();
    }

    private ScopeType resolveScope(CalcContext ctx) {
        try {
            return ScopeType.valueOf(ctx.scope());
        } catch (Exception e) {
            return ScopeType.SCOPE_1;
        }
    }

    public List<GreenhouseGas> getSupportedGases() {
        return CBAM_GASES;
    }
}
