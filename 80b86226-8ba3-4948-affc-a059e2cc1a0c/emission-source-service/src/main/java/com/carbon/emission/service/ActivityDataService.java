package com.carbon.emission.service;

import com.carbon.common.api.ErrorCode;
import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.audit.AuditLog;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.enums.ActivityDataType;
import com.carbon.common.exception.BusinessException;
import com.carbon.common.exception.NotFoundException;
import com.carbon.emission.entity.ActivityData;
import com.carbon.emission.entity.EmissionSource;
import com.carbon.emission.repository.ActivityDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.YearMonth;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ActivityDataService {

    private final ActivityDataRepository repository;
    private final EmissionSourceService emissionSourceService;
    private final MongoTemplate mongoTemplate;

    @Value("${emission.interpolation.window-size:3}")
    private int windowSize;

    @Value("${emission.interpolation.min-neighbors:2}")
    private int minNeighbors;

    @Value("${emission.activity.import-chunk-size:1000}")
    private int chunkSize;

    @AuditLog(module = "活动数据", operation = "创建活动数据", resourceType = "ActivityData")
    @Transactional
    @CacheEvict(value = "activityData", allEntries = true)
    public ActivityData create(ActivityData data) {
        if (data.getEvidenceIds() != null && !data.getEvidenceIds().isEmpty()) {
            com.carbon.common.verification.EvidenceChainValidator.requireEvidence(
                    data.getEvidenceIds(), "活动数据");
        }
        validateSourceAndFill(data);
        convertUnitsAndValidate(data);
        data.setPeriod(buildPeriod(data));
        String tenantId = UserContextHolder.getTenantId();
        data.setTenantId(tenantId);
        data.setImportedAt(Instant.now());
        return repository.save(data);
    }

    @AuditLog(module = "活动数据", operation = "更新活动数据", resourceType = "ActivityData")
    @Transactional
    @CacheEvict(value = "activityData", allEntries = true)
    public ActivityData update(String id, ActivityData data) {
        ActivityData existing = mustGet(id);
        validateSourceAndFill(data);
        convertUnitsAndValidate(data);
        data.setPeriod(buildPeriod(data));
        org.springframework.beans.BeanUtils.copyProperties(data, existing,
                "id", "tenantId", "createdAt", "createdBy", "importedAt", "importBatchId",
                "interpolated", "interpolationTrace", "evidenceIds");
        return repository.save(existing);
    }

    @Transactional
    public void delete(String id) {
        repository.deleteById(id);
    }

    public ActivityData getById(String id) {
        return mustGet(id);
    }

    public PageResult<ActivityData> listByPeriod(String period, String sourceId,
                                                 ActivityDataType type, PageQuery pq) {
        String tenantId = UserContextHolder.getTenantId();
        PageRequest pr = PageRequest.of(pq.getPage(), pq.getSize(),
                Sort.by(Sort.Direction.fromString(pq.getSortDirection()),
                        pq.getSortBy() != null ? pq.getSortBy() : "createdAt"));

        Criteria c = Criteria.where("tenantId").is(tenantId);
        if (period != null) c.and("period").is(period);
        if (sourceId != null) c.and("sourceId").is(sourceId);
        if (type != null) c.and("activityDataType").is(type);

        Query q = new Query(c).with(pr);
        List<ActivityData> list = mongoTemplate.find(q, ActivityData.class);
        long total = mongoTemplate.count(Query.of(q).limit(-1).skip(-1), ActivityData.class);
        return PageResult.of(list, pq.getPage(), pq.getSize(), total);
    }

    public PageResult<ActivityData> listByBatch(String batchId, PageQuery pq) {
        Page<ActivityData> page = repository.findByTenantIdAndImportBatchId(
                UserContextHolder.getTenantId(), batchId,
                PageRequest.of(pq.getPage(), pq.getSize(), Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
    }

    public Map<String, Object> summarize(Integer year, Integer month) {
        String tenantId = UserContextHolder.getTenantId();
        String period = String.format("%04d-%02d", year, month);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("period", period);
        summary.put("totalRecords", repository.countByTenantIdAndPeriodYearAndPeriodMonth(tenantId, year, month));
        summary.put("interpolatedCount", repository.countByTenantIdAndPeriodAndInterpolatedTrue(tenantId, period));
        summary.put("byType", repository.summarizeByType(tenantId, year, month));
        return summary;
    }

    @AuditLog(module = "活动数据", operation = "批量导入活动数据", resourceType = "ActivityData")
    @Transactional
    public Map<String, Object> batchImport(List<ActivityData> list, String batchId) {
        String tenantId = UserContextHolder.getTenantId();
        int inserted = 0, updated = 0, failed = 0;
        List<String> issues = new ArrayList<>();

        for (int i = 0; i < list.size(); i += chunkSize) {
            List<ActivityData> chunk = list.subList(i, Math.min(i + chunkSize, list.size()));
            BulkOperations bulk = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, ActivityData.class);

            for (ActivityData d : chunk) {
                try {
                    validateSourceAndFill(d);
                    convertUnitsAndValidate(d);
                    d.setTenantId(tenantId);
                    d.setPeriod(buildPeriod(d));
                    d.setImportBatchId(batchId);
                    d.setImportedAt(Instant.now());

                    Optional<ActivityData> existing = repository
                            .findByTenantIdAndSourceIdAndPeriod(tenantId, d.getSourceId(), d.getPeriod());
                    if (existing.isPresent()) {
                        Query q = new Query(Criteria.where("tenantId").is(tenantId)
                                .and("sourceId").is(d.getSourceId())
                                .and("period").is(d.getPeriod()));
                        Update u = new Update()
                                .set("rawValue", d.getRawValue())
                                .set("activityValue", d.getActivityValue())
                                .set("netCalorificValue", d.getNetCalorificValue())
                                .set("carbonContent", d.getCarbonContent())
                                .set("oxidationRate", d.getOxidationRate())
                                .set("qualityStatus", d.getQualityStatus())
                                .unset("interpolated")
                                .unset("interpolationTrace")
                                .set("updatedBy", UserContextHolder.getUserId())
                                .set("updatedAt", Instant.now());
                        bulk.updateOne(q, u);
                        updated++;
                    } else {
                        bulk.insert(d);
                        inserted++;
                    }
                } catch (Exception e) {
                    failed++;
                    issues.add(String.format("行%d source=%s: %s", i + 1, d.getSourceCode(), e.getMessage()));
                }
            }
            bulk.execute();
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("batchId", batchId);
        result.put("inserted", inserted);
        result.put("updated", updated);
        result.put("failed", failed);
        result.put("total", list.size());
        if (!issues.isEmpty()) result.put("issues", issues.subList(0, 100));
        return result;
    }

    @AuditLog(module = "活动数据", operation = "数据插值补全", resourceType = "ActivityData")
    @Transactional
    public Map<String, Object> interpolateMissing(Integer year, Integer month) {
        String tenantId = UserContextHolder.getTenantId();
        String targetPeriod = String.format("%04d-%02d", year, month);
        List<EmissionSource> sources = emissionSourceService.listBrief();

        int interpolated = 0;
        List<Map<String, Object>> details = new ArrayList<>();
        Map<String, ActivityData> existingMap = new HashMap<>();
        for (ActivityData d : repository.findByTenantIdAndPeriod(tenantId, targetPeriod)) {
            existingMap.put(d.getSourceId(), d);
        }

        for (EmissionSource source : sources) {
            if (existingMap.containsKey(source.getId())) continue;
            try {
                List<ActivityData> history = repository
                        .findByTenantIdAndSourceIdOrderByPeriodYearAscPeriodMonthAsc(tenantId, source.getId());
                BigDecimal interpolatedValue = linearInterpolate(history, YearMonth.of(year, month));
                if (interpolatedValue == null) continue;

                ActivityData d = new ActivityData();
                d.setTenantId(tenantId);
                d.setSourceId(source.getId());
                d.setSourceCode(source.getCode());
                d.setSourceName(source.getName());
                d.setPeriodYear(year);
                d.setPeriodMonth(month);
                d.setPeriod(targetPeriod);
                d.setActivityDataType(source.getActivityDataType());
                d.setActivityValue(interpolatedValue);
                d.setRawValue(interpolatedValue);
                d.setUnit(source.getUnit());
                d.setInputUnit(source.getUnit());
                d.setOutputUnit(source.getUnit());
                d.setInterpolated(true);
                d.setInterpolationTrace(List.of(
                        "method=LINEAR",
                        "windowSize=" + windowSize,
                        "historyPoints=" + history.size()
                ));
                d.setQualityStatus("INTERPOLATED");
                d.setImportedAt(Instant.now());
                repository.save(d);
                interpolated++;
                if (details.size() < 50) {
                    details.add(Map.of("sourceId", source.getId(),
                            "sourceCode", source.getCode(),
                            "value", interpolatedValue));
                }
            } catch (Exception e) {
                log.warn("Interpolate source {} failed: {}", source.getId(), e.getMessage());
            }
        }

        return Map.of("period", targetPeriod, "interpolated", interpolated, "details", details);
    }

    @Transactional
    public void deleteByPeriod(String period) {
        repository.deleteByTenantIdAndPeriod(UserContextHolder.getTenantId(), period);
    }

    private BigDecimal linearInterpolate(List<ActivityData> history, YearMonth target) {
        if (history == null || history.size() < minNeighbors) return null;
        TreeMap<YearMonth, BigDecimal> sorted = new TreeMap<>();
        for (ActivityData d : history) {
            if (d.getActivityValue() == null || d.getInterpolated()) continue;
            YearMonth ym = d.getYearMonth();
            if (ym == null) continue;
            sorted.put(ym, d.getActivityValue());
        }
        if (sorted.size() < minNeighbors) return null;
        if (sorted.containsKey(target)) return sorted.get(target);

        Map.Entry<YearMonth, BigDecimal> lower = sorted.lowerEntry(target);
        Map.Entry<YearMonth, BigDecimal> higher = sorted.higherEntry(target);
        if (lower == null && higher == null) return null;
        if (lower == null) return higher.getValue();
        if (higher == null) return lower.getValue();

        long lowerMonths = monthsFromZero(lower.getKey());
        long higherMonths = monthsFromZero(higher.getKey());
        long targetMonths = monthsFromZero(target);
        if (higherMonths == lowerMonths) return lower.getValue();

        BigDecimal ratio = BigDecimal.valueOf(targetMonths - lowerMonths)
                .divide(BigDecimal.valueOf(higherMonths - lowerMonths), 6, RoundingMode.HALF_UP);
        return lower.getValue()
                .add(higher.getValue().subtract(lower.getValue()).multiply(ratio))
                .setScale(6, RoundingMode.HALF_UP);
    }

    private long monthsFromZero(YearMonth ym) {
        return (long) ym.getYear() * 12 + ym.getMonthValue();
    }

    private void validateSourceAndFill(ActivityData d) {
        if (d.getSourceId() == null && d.getSourceCode() != null) {
            Optional<EmissionSource> src = emissionSourceService.getByCode(d.getSourceCode());
            if (src.isEmpty()) {
                throw new BusinessException(ErrorCode.EMISSION_SOURCE_NOT_FOUND,
                        "排放源不存在: " + d.getSourceCode());
            }
            d.setSourceId(src.get().getId());
            d.setSourceName(src.get().getName());
        } else if (d.getSourceId() != null) {
            EmissionSource src = emissionSourceService.mustGet(d.getSourceId());
            d.setSourceCode(src.getCode());
            d.setSourceName(src.getName());
            if (d.getActivityDataType() == null) d.setActivityDataType(src.getActivityDataType());
        } else {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "sourceId或sourceCode必须提供一个");
        }
    }

    private void convertUnitsAndValidate(ActivityData d) {
        if (d.getRawValue() == null) {
            throw new BusinessException(ErrorCode.ACTIVITY_DATA_VALIDATION_FAILED, "原始值不能为空");
        }
        if (d.getRawValue().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.ACTIVITY_DATA_VALIDATION_FAILED, "原始值不能为负");
        }
        List<String> issues = new ArrayList<>();
        d.setActivityValue(d.getRawValue());

        if (d.getActivityDataType() == ActivityDataType.FUEL_COMBUSTION) {
            if (d.getNetCalorificValue() != null && d.getRawValue() != null) {
                d.setActivityValue(d.getRawValue().multiply(d.getNetCalorificValue(),
                                new MathContext(10, RoundingMode.HALF_UP))
                        .divide(BigDecimal.valueOf(1000), 10, RoundingMode.HALF_UP));
                d.setOutputUnit("TJ");
                if (d.getNetCalorificValue().compareTo(BigDecimal.ZERO) <= 0) {
                    issues.add("热值NCV必须为正数");
                }
            } else {
                issues.add("燃料燃烧需提供净热值(NCV)");
            }
            if (d.getCarbonContent() != null
                    && d.getCarbonContent().compareTo(BigDecimal.ZERO) <= 0) {
                issues.add("碳含量必须为正");
            }
            if (d.getOxidationRate() != null
                    && (d.getOxidationRate().compareTo(BigDecimal.ZERO) < 0
                    || d.getOxidationRate().compareTo(BigDecimal.ONE) > 0)) {
                issues.add("氧化率必须在[0,1]区间");
            }
        }

        if (!issues.isEmpty()) {
            d.setQualityIssues(issues);
            d.setQualityStatus("WARNING");
            log.warn("ActivityData validation sourceId={} issues={}", d.getSourceId(), issues);
        } else {
            d.setQualityStatus("OK");
        }
    }

    private String buildPeriod(ActivityData d) {
        if (d.getPeriodYear() == null || d.getPeriodMonth() == null) {
            throw new BusinessException(ErrorCode.ACTIVITY_DATA_VALIDATION_FAILED, "必须提供年度和月份");
        }
        if (d.getPeriodMonth() < 1 || d.getPeriodMonth() > 12) {
            throw new BusinessException(ErrorCode.ACTIVITY_DATA_VALIDATION_FAILED, "月份范围1-12");
        }
        return String.format("%04d-%02d", d.getPeriodYear(), d.getPeriodMonth());
    }

    private ActivityData mustGet(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("活动数据", id));
    }
}
