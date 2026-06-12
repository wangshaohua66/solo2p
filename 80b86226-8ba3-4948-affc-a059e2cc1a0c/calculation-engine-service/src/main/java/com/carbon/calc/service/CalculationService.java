package com.carbon.calc.service;

import com.carbon.calc.client.EmissionSourceClient;
import com.carbon.calc.client.FactorClient;
import com.carbon.calc.entity.CalculationDiff;
import com.carbon.calc.entity.CalculationResult;
import com.carbon.calc.entity.CalculationTask;
import com.carbon.calc.methodology.AccountingMethodology;
import com.carbon.calc.methodology.CbamMethodology;
import com.carbon.calc.methodology.GhgProtocolMethodology;
import com.carbon.calc.methodology.Iso14064Methodology;
import com.carbon.calc.repository.CalculationDiffRepository;
import com.carbon.calc.repository.CalculationResultRepository;
import com.carbon.calc.repository.CalculationTaskRepository;
import com.carbon.common.api.ErrorCode;
import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.audit.AuditLog;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.enums.AccountingStandard;
import com.carbon.common.enums.FactorLibrary;
import com.carbon.common.exception.BusinessException;
import com.carbon.common.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.time.Instant;
import java.time.YearMonth;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CalculationService {

    private final CalculationTaskRepository taskRepo;
    private final CalculationResultRepository resultRepo;
    private final CalculationDiffRepository diffRepo;

    private final FactorClient factorClient;
    private final EmissionSourceClient emissionClient;
    private final DiffAnalyzer diffAnalyzer;

    private final Iso14064Methodology iso;
    private final GhgProtocolMethodology ghg;
    private final CbamMethodology cbam;

    private final ApplicationEventPublisher eventPublisher;

    @Value("${calculation.parallelism:16}")
    private int parallelism;

    @AuditLog(module = "核算引擎", operation = "发起核算任务", resourceType = "CalculationTask")
    @Transactional
    public CalculationTask submitTask(Integer year, Integer month,
                                      List<AccountingStandard> standards,
                                      List<String> sourceIds,
                                      String scopeFilter,
                                      String taskName,
                                      List<String> evidenceIds) {
        if (evidenceIds != null && !evidenceIds.isEmpty()) {
            com.carbon.common.verification.EvidenceChainValidator.requireEvidence(
                    evidenceIds, "核算任务");
        }
        String tenantId = UserContextHolder.getTenantId();
        String period = String.format("%04d-%02d", year, month);
        CalculationTask task = CalculationTask.builder()
                .taskName(taskName != null ? taskName : "月度核算-" + period)
                .periodYear(year)
                .periodMonth(month)
                .period(period)
                .periodStart(YearMonth.of(year, month).atDay(1))
                .periodEnd(YearMonth.of(year, month).atEndOfMonth())
                .standards(standards != null ? standards :
                        List.of(AccountingStandard.ISO_14064_1, AccountingStandard.GHG_PROTOCOL, AccountingStandard.CBAM))
                .sourceIds(sourceIds)
                .scopeFilter(scopeFilter != null ? List.of(scopeFilter) : null)
                .status("RUNNING")
                .triggeredBy(UserContextHolder.getUserId())
                .startedAt(Instant.now())
                .evidenceIds(evidenceIds != null ? evidenceIds : new ArrayList<>())
                .build();
        task.setTenantId(tenantId);
        task = taskRepo.save(task);

        eventPublisher.publishEvent(new CalculationTaskSubmittedEvent(task.getId()));

        return task;
    }

    public static class CalculationTaskSubmittedEvent {
        private final String taskId;
        public CalculationTaskSubmittedEvent(String taskId) { this.taskId = taskId; }
        public String getTaskId() { return taskId; }
    }

    @Slf4j
    @Service
    @RequiredArgsConstructor
    public static class CalculationTaskAsyncExecutor {

        private final CalculationTaskRepository taskRepo;
        private final CalculationResultRepository resultRepo;
        private final CalculationDiffRepository diffRepo;
        private final EmissionSourceClient emissionClient;
        private final FactorClient factorClient;
        private final Iso14064Methodology iso;
        private final GhgProtocolMethodology ghg;
        private final CbamMethodology cbam;
        private final DiffAnalyzer diffAnalyzer;

        @Value("${calculation.parallelism:16}")
        private int parallelism;

        @Async
        @EventListener
        public void onTaskSubmitted(CalculationTaskSubmittedEvent event) {
            executeAsync(event.getTaskId());
        }

        @Async
        public void executeAsync(String taskId) {
            CalculationTask task = taskRepo.findById(taskId).orElseThrow();
            long start = System.currentTimeMillis();
            try {
                Map<AccountingStandard, List<CalculationResult>> resultsByStandard = runParallel(task);
                persistResults(taskId, resultsByStandard);
                List<CalculationDiff> diffs = diffAnalyzer.analyze(taskId, task.getPeriod(), resultsByStandard);
                diffRepo.saveAll(diffs);

                Map<String, Object> metrics = new LinkedHashMap<>();
                for (Map.Entry<AccountingStandard, List<CalculationResult>> e : resultsByStandard.entrySet()) {
                    BigDecimal total = e.getValue().stream()
                            .map(CalculationResult::getCo2eqTons)
                            .filter(Objects::nonNull)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    metrics.put(e.getKey().name() + "_total_tCO2e", total.round(new MathContext(6)));
                    metrics.put(e.getKey().name() + "_records", e.getValue().size());
                }
                metrics.put("diff_count", diffs.size());

                task.setMetrics(metrics);
                task.setStatus("COMPLETED");
                task.setCompletedAt(Instant.now());
                task.setTotalDurationMs((double) (System.currentTimeMillis() - start));
                task.setRecordsCount((long) resultsByStandard.values().stream().mapToInt(List::size).sum());
                taskRepo.save(task);
            } catch (Exception e) {
                log.error("Calculation task failed taskId={}", taskId, e);
                task.setStatus("FAILED");
                task.setErrorMessage(e.getMessage());
                task.setCompletedAt(Instant.now());
                taskRepo.save(task);
                throw new BusinessException(ErrorCode.CALCULATION_TASK_FAILED, e.getMessage());
            }
        }

        private Map<AccountingStandard, List<CalculationResult>> runParallel(CalculationTask task) {
            List<CalcRecord> dataRecords = fetchSourceRecords(task);
            if (dataRecords.isEmpty()) {
                throw new BusinessException(ErrorCode.CALCULATION_SOURCE_EMPTY,
                        "活动数据为空，请先导入月度活动数据");
            }

            Map<AccountingStandard, AccountingMethodology> methodologies = Map.of(
                    AccountingStandard.ISO_14064_1, iso,
                    AccountingStandard.GHG_PROTOCOL, ghg,
                    AccountingStandard.CBAM, cbam
            );

            Map<AccountingStandard, List<CalculationResult>> out = new ConcurrentHashMap<>();
            ExecutorService executor = Executors.newFixedThreadPool(parallelism);
            try {
                List<Future<?>> futures = new ArrayList<>();
                for (AccountingStandard std : task.getStandards()) {
                    AccountingMethodology m = methodologies.get(std);
                    if (m == null) continue;
                    out.putIfAbsent(std, Collections.synchronizedList(new ArrayList<>()));

                    for (CalcRecord rec : dataRecords) {
                        futures.add(executor.submit(() -> {
                            try {
                                AccountingMethodology.CalcContext ctx = buildContext(rec, task, m);
                                Optional<String> matchKey = m.resolveFactorMatchKey(ctx);
                                AccountingMethodology.FactorSnapshot factor = null;
                                if (matchKey.isPresent()) {
                                    factor = fetchFactorSnapshot(m.defaultFactorLibrary(), matchKey.get(), task.getPeriod());
                                }
                                CalculationResult r = m.calculate(ctx, factor);
                                if (r != null) out.get(std).add(r);
                            } catch (Exception e) {
                                log.warn("Calc error source={} std={}: {}", rec.sourceCode, std, e.getMessage());
                            }
                        }));
                    }
                }
                for (Future<?> f : futures) f.get(15, TimeUnit.MINUTES);
                return out;
            } catch (Exception e) {
                throw new BusinessException(ErrorCode.CALCULATION_TASK_FAILED, e.getMessage());
            } finally {
                executor.shutdownNow();
            }
        }

        @Transactional
        public void persistResults(String taskId, Map<AccountingStandard, List<CalculationResult>> byStandard) {
            resultRepo.deleteByTaskId(taskId);
            diffRepo.deleteByTaskId(taskId);
            List<CalculationResult> all = new ArrayList<>();
            for (List<CalculationResult> l : byStandard.values()) all.addAll(l);
            if (!all.isEmpty()) resultRepo.saveAll(all);
        }

        private List<CalcRecord> fetchSourceRecords(CalculationTask task) {
            List<CalcRecord> records = new ArrayList<>();
            int page = 0, size = 5000;
            while (true) {
                var resp = emissionClient.listActivityData(task.getPeriod(), null, page, size);
                if (resp == null || resp.getCode() == null || resp.getCode() != 0) {
                    throw new BusinessException(ErrorCode.REMOTE_CALL_FAILED,
                            "排放源服务调用失败，无法获取活动数据");
                }
                Map<String, Object> data = resp.getData();
                if (data == null) break;
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> content = (List<Map<String, Object>>) data.getOrDefault("content", List.of());
                for (Map<String, Object> row : content) {
                    records.add(CalcRecord.fromMap(row));
                }
                long total = ((Number) data.getOrDefault("total", 0)).longValue();
                if ((long) (page + 1) * size >= total) break;
                page++;
            }
            return records;
        }

        private AccountingMethodology.CalcContext buildContext(CalcRecord rec,
                                                               CalculationTask task,
                                                               AccountingMethodology m) {
            return new AccountingMethodology.CalcContext(
                    task.getTenantId(),
                    task.getId(),
                    task.getPeriodYear(),
                    task.getPeriodMonth(),
                    task.getPeriod(),
                    rec.sourceId,
                    rec.sourceCode,
                    rec.sourceName,
                    rec.scope,
                    rec.activityDataType,
                    rec.activityValue,
                    rec.activityUnit,
                    rec.rawValue,
                    rec.netCalorificValue,
                    rec.carbonContent,
                    rec.oxidationRate,
                    rec.factorMatchKey,
                    rec.candidateKeys,
                    rec.gasOverride
            );
        }

        private AccountingMethodology.FactorSnapshot fetchFactorSnapshot(FactorLibrary library,
                                                                         String matchKey,
                                                                         String period) {
            var resp = factorClient.matchByPeriod(library, matchKey, period);
            if (resp == null || resp.getCode() == null || resp.getCode() != 0 || resp.getData() == null) {
                throw new BusinessException(ErrorCode.FACTOR_NOT_FOUND,
                        String.format("因子库 %s 未找到匹配键 %s (期间=%s)", library, matchKey, period));
            }
            Map<String, Object> f = resp.getData();
            BigDecimal v = toDecimal(f.get("factorValue"));
            return new AccountingMethodology.FactorSnapshot(
                    matchKey,
                    library,
                    (String) f.getOrDefault("versionCode", "2024Q1"),
                    v != null ? v : BigDecimal.ZERO,
                    (String) f.getOrDefault("factorUnit", "tCO2e/t"),
                    toDecimal(f.get("carbonContent")),
                    toDecimal(f.get("oxidationRate")),
                    toDecimal(f.get("gwpUsed")),
                    com.carbon.common.enums.GreenhouseGas.CO2,
                    (String) f.get("formula"),
                    (String) f.getOrDefault("tier", "TIER2")
            );
        }

        private static BigDecimal toDecimal(Object o) {
            if (o == null) return null;
            if (o instanceof BigDecimal bd) return bd;
            if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
            try {
                return new BigDecimal(String.valueOf(o));
            } catch (Exception e) {
                return null;
            }
        }
    }

    public PageResult<CalculationTask> listTasks(PageQuery pq) {
        var page = taskRepo.findByTenantIdOrderByCreatedAtDesc(
                UserContextHolder.getTenantId(),
                PageRequest.of(pq.getPage(), pq.getSize(),
                        Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
    }

    public CalculationTask getTask(String taskId) {
        return taskRepo.findById(taskId)
                .orElseThrow(() -> new NotFoundException("核算任务", taskId));
    }

    public List<CalculationResult> listResults(String taskId, AccountingStandard standard) {
        if (standard != null) {
            return resultRepo.findByTaskIdAndStandard(taskId, standard);
        }
        return resultRepo.findByTaskId(taskId);
    }

    public Map<String, Object> taskSummary(String taskId) {
        CalculationTask task = getTask(taskId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("task", task);
        Map<String, Object> byStandard = new LinkedHashMap<>();
        for (AccountingStandard std : task.getStandards()) {
            Map<String, Object> stdOut = new LinkedHashMap<>();
            var gases = resultRepo.aggregateByGas(taskId, std);
            var scopes = resultRepo.aggregateByScope(taskId, std);
            var sum = resultRepo.sumTotal(taskId, std);
            stdOut.put("byGas", gases);
            stdOut.put("byScope", scopes);
            stdOut.put("totalCO2e", sum.isEmpty() ? BigDecimal.ZERO :
                    sum.get(0).get("total", BigDecimal.class));
            byStandard.put(std.name(), stdOut);
        }
        out.put("standards", byStandard);
        out.put("diffSummary", diffRepo.summaryByPair(taskId));
        return out;
    }

    public List<CalculationDiff> listDiffs(String taskId, AccountingStandard a, AccountingStandard b) {
        if (a != null && b != null) {
            return diffRepo.findByTaskAndStandardPair(taskId, a, b);
        }
        return diffRepo.findByTaskIdOrderByDeltaAbsDesc(taskId);
    }

    public static class CalcRecord {
        public String sourceId;
        public String sourceCode;
        public String sourceName;
        public String scope;
        public String activityDataType;
        public BigDecimal activityValue;
        public String activityUnit;
        public BigDecimal rawValue;
        public BigDecimal netCalorificValue;
        public BigDecimal carbonContent;
        public BigDecimal oxidationRate;
        public String factorMatchKey;
        public List<String> candidateKeys;
        public com.carbon.common.enums.GreenhouseGas gasOverride;

        public static CalcRecord fromMap(Map<String, Object> m) {
            CalcRecord r = new CalcRecord();
            r.sourceId = (String) m.get("sourceId");
            r.sourceCode = (String) m.get("sourceCode");
            r.sourceName = (String) m.getOrDefault("sourceName", r.sourceCode);
            r.scope = (String) m.get("scope");
            r.activityDataType = m.get("activityDataType") != null ? String.valueOf(m.get("activityDataType")) : null;
            r.activityValue = toDecimalLocal(m.get("activityValue"));
            r.activityUnit = (String) m.getOrDefault("outputUnit", "t");
            r.rawValue = toDecimalLocal(m.get("rawValue"));
            r.netCalorificValue = toDecimalLocal(m.get("netCalorificValue"));
            r.carbonContent = toDecimalLocal(m.get("carbonContent"));
            r.oxidationRate = toDecimalLocal(m.get("oxidationRate"));
            r.factorMatchKey = (String) m.get("factorMatchKey");
            return r;
        }

        private static BigDecimal toDecimalLocal(Object o) {
            if (o == null) return null;
            if (o instanceof BigDecimal bd) return bd;
            if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
            try {
                return new BigDecimal(String.valueOf(o));
            } catch (Exception e) {
                return null;
            }
        }
    }
}
