package com.carbon.calc.service;

import com.carbon.calc.entity.CalculationResult;
import com.carbon.calc.entity.CalculationDiff;
import com.carbon.common.enums.AccountingStandard;
import com.carbon.common.enums.GreenhouseGas;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Component
public class DiffAnalyzer {

    public List<CalculationDiff> analyze(String taskId, String period,
                                         Map<AccountingStandard, List<CalculationResult>> byStandard) {
        if (byStandard.size() < 2) return Collections.emptyList();
        List<AccountingStandard> standards = new ArrayList<>(byStandard.keySet());
        List<CalculationDiff> diffs = new ArrayList<>();

        for (int i = 0; i < standards.size(); i++) {
            for (int j = i + 1; j < standards.size(); j++) {
                AccountingStandard a = standards.get(i);
                AccountingStandard b = standards.get(j);
                Map<String, CalculationResult> mapA = indexBySourceGas(byStandard.get(a));
                Map<String, CalculationResult> mapB = indexBySourceGas(byStandard.get(b));

                Set<String> keys = new HashSet<>();
                keys.addAll(mapA.keySet());
                keys.addAll(mapB.keySet());

                for (String key : keys) {
                    CalculationResult ra = mapA.get(key);
                    CalculationResult rb = mapB.get(key);
                    BigDecimal va = ra != null ? ra.getCo2eqTons() : BigDecimal.ZERO;
                    BigDecimal vb = rb != null ? rb.getCo2eqTons() : BigDecimal.ZERO;
                    BigDecimal delta = va.subtract(vb);
                    if (delta.abs().compareTo(BigDecimal.valueOf(0.0001)) < 0) continue;
                    BigDecimal base = va.max(vb);
                    BigDecimal deltaPct = base.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO
                            : delta.divide(base, 6, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100));
                    String sourceId = ra != null ? ra.getSourceId() : (rb != null ? rb.getSourceId() : key);
                    String sourceCode = ra != null ? ra.getSourceCode() : (rb != null ? rb.getSourceCode() : null);
                    GreenhouseGas gas = ra != null ? ra.getGas() : (rb != null ? rb.getGas() : null);
                    Map<String, Object> details = new LinkedHashMap<>();
                    details.put("aFormula", ra != null ? ra.getFormula() : "N/A");
                    details.put("bFormula", rb != null ? rb.getFormula() : "N/A");
                    details.put("aFactor", extractFactorInfo(ra));
                    details.put("bFactor", extractFactorInfo(rb));
                    details.put("aParams", ra != null ? ra.getFormulaParams() : null);
                    details.put("bParams", rb != null ? rb.getFormulaParams() : null);

                    String cause = diagnoseRootCause(ra, rb);
                    CalculationDiff diff = CalculationDiff.builder()
                            .taskId(taskId)
                            .period(period)
                            .standardA(a)
                            .standardB(b)
                            .sourceId(sourceId)
                            .sourceCode(sourceCode)
                            .gas(gas)
                            .co2eqA(va)
                            .co2eqB(vb)
                            .deltaAbs(delta)
                            .deltaPercent(deltaPct)
                            .rootCause(cause)
                            .diffFormula(String.format("[%s](%s) - [%s](%s)",
                                    a.name(), ra != null ? ra.getFormula() : "空结果",
                                    b.name(), rb != null ? rb.getFormula() : "空结果"))
                            .diffDetails(details)
                            .build();
                    diffs.add(diff);
                }
            }
        }
        diffs.sort((x, y) -> y.getDeltaAbs().abs().compareTo(x.getDeltaAbs().abs()));
        return diffs;
    }

    private Map<String, CalculationResult> indexBySourceGas(List<CalculationResult> list) {
        Map<String, CalculationResult> m = new HashMap<>();
        if (list == null) return m;
        for (CalculationResult r : list) {
            String key = r.getSourceId() + "|" + (r.getGas() != null ? r.getGas().name() : "");
            m.put(key, r);
        }
        return m;
    }

    private String extractFactorInfo(CalculationResult r) {
        if (r == null) return "null";
        return String.format("%s/%s %s %s",
                r.getFactorLibrary(), r.getFactorVersion(),
                r.getFactorValue(), r.getFactorUnit());
    }

    private String diagnoseRootCause(CalculationResult a, CalculationResult b) {
        if (a == null) return "A标准无结果(CBAM可能不覆盖该活动数据)";
        if (b == null) return "B标准无结果(CBAM可能不覆盖该活动数据)";
        boolean factorDiff = !Objects.equals(a.getFactorValue(), b.getFactorValue())
                || !Objects.equals(a.getFactorLibrary(), b.getFactorLibrary());
        boolean gwpDiff = !Objects.equals(a.getGwpUsed(), b.getGwpUsed());
        boolean formulaDiff = !Objects.equals(a.getFormula(), b.getFormula());
        List<String> causes = new ArrayList<>();
        if (factorDiff) causes.add("排放因子库/取值不同");
        if (gwpDiff) causes.add("GWP值不同(IPCC AR4 vs AR5 vs AR6)");
        if (formulaDiff) causes.add("核算公式边界不同(含碳×氧化率 vs 简化因子)");
        return causes.isEmpty() ? "其他" : String.join(" + ", causes);
    }
}
