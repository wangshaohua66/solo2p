package com.carbon.factor.service;

import com.carbon.common.api.ErrorCode;
import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.audit.AuditLog;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.enums.ActivityDataType;
import com.carbon.common.enums.FactorLibrary;
import com.carbon.common.enums.GreenhouseGas;
import com.carbon.common.enums.ScopeType;
import com.carbon.common.exception.BusinessException;
import com.carbon.common.exception.NotFoundException;
import com.carbon.factor.entity.EmissionFactor;
import com.carbon.factor.entity.FactorChangeLog;
import com.carbon.factor.entity.FactorVersion;
import com.carbon.factor.repository.EmissionFactorRepository;
import com.carbon.factor.repository.FactorChangeLogRepository;
import com.carbon.factor.repository.FactorVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class FactorService {

    private final EmissionFactorRepository factorRepo;
    private final FactorVersionRepository versionRepo;
    private final FactorChangeLogRepository changeLogRepo;
    private final MongoTemplate mongoTemplate;

    @Cacheable(value = "factors", key = "'match-'+#library+'-'+#matchKey+'-'+#period")
    public EmissionFactor matchByPeriod(FactorLibrary library, String matchKey, YearMonth period) {
        LocalDate periodDate = period.atDay(1);
        Optional<EmissionFactor> opt = factorRepo.findEffectiveByPeriod(library, matchKey, periodDate);
        if (opt.isPresent()) return opt.get();

        Optional<FactorVersion> v = resolveVersionForPeriod(library, period);
        if (v.isEmpty()) return null;
        return factorRepo.findByLibraryAndMatchKeyAndVersionCode(library, matchKey, v.get().getVersionCode())
                .orElse(null);
    }

    @Cacheable(value = "factors", key = "'version-'+#library+'-'+#versionCode+'-'+#matchKey+'-'+#gas")
    public EmissionFactor getByVersion(FactorLibrary library, String versionCode,
                                       String matchKey, GreenhouseGas gas) {
        if (gas != null) {
            return factorRepo.findByLibraryMatchKeyVersionAndGas(library, matchKey, versionCode, gas)
                    .orElse(null);
        }
        return factorRepo.findByLibraryAndMatchKeyAndVersionCode(library, matchKey, versionCode)
                .orElse(null);
    }

    @Cacheable(value = "factors", key = "'latest-'+#library+'-'+#matchKey")
    public EmissionFactor getLatest(FactorLibrary library, String matchKey) {
        return versionRepo.findFirstByLibraryOrderByReleaseDateDesc(library)
                .flatMap(v -> factorRepo.findByLibraryAndMatchKeyAndVersionCode(library, matchKey, v.getVersionCode()))
                .orElse(null);
    }

    @Cacheable(value = "factors", key = "'bulk-'+#library+'-'+#versionCode+'-'+T(java.util.Objects).hash(#matchKeys)")
    public Map<String, EmissionFactor> bulkMatch(FactorLibrary library,
                                                  String versionCode,
                                                  List<String> matchKeys) {
        List<EmissionFactor> list = factorRepo.findByLibraryAndMatchKeysInAndVersion(library, matchKeys, versionCode);
        Map<String, EmissionFactor> map = new HashMap<>();
        for (EmissionFactor f : list) map.put(f.getMatchKey(), f);
        return map;
    }

    public PageResult<EmissionFactor> list(FactorLibrary library, String versionCode,
                                           ScopeType scope, ActivityDataType type,
                                           String keyword, PageQuery pq) {
        String tenantId = UserContextHolder.getTenantIdSafe();
        Criteria c = new Criteria();
        if (library != null) c.and("library").is(library);
        if (versionCode != null) c.and("versionCode").is(versionCode);
        if (scope != null) c.and("scope").is(scope);
        if (type != null) c.and("activityDataType").is(type);
        if (keyword != null && !keyword.isBlank()) {
            c.orOperator(
                    Criteria.where("matchKey").regex(keyword, "i"),
                    Criteria.where("factorName").regex(keyword, "i"),
                    Criteria.where("factorCode").regex(keyword, "i")
            );
        }
        Criteria finalC = c.getCriteriaObject().isEmpty() ? new Criteria() : c;
        Query q = new Query(finalC).with(PageRequest.of(pq.getPage(), pq.getSize(),
                Sort.by(Sort.Direction.DESC, pq.getSortBy() != null ? pq.getSortBy() : "createdAt")));
        List<EmissionFactor> list = mongoTemplate.find(q, EmissionFactor.class);
        long total = mongoTemplate.count(Query.of(q).limit(-1).skip(-1), EmissionFactor.class);
        return PageResult.of(list, pq.getPage(), pq.getSize(), total);
    }

    public EmissionFactor getById(String id) {
        return factorRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("排放因子", id));
    }

    @AuditLog(module = "因子库", operation = "创建排放因子", resourceType = "EmissionFactor")
    @Transactional
    @CacheEvict(value = "factors", allEntries = true)
    public EmissionFactor create(EmissionFactor factor) {
        FactorVersion v = versionRepo.findByLibraryAndVersionCode(factor.getLibrary(), factor.getVersionCode())
                .orElseThrow(() -> new BusinessException(ErrorCode.FACTOR_VERSION_NOT_FOUND,
                        "版本不存在: " + factor.getVersionCode()));
        if (Boolean.TRUE.equals(v.getLocked())) {
            throw new BusinessException(ErrorCode.FACTOR_VERSION_CONFLICT, "版本已锁定，不能修改");
        }
        return factorRepo.save(factor);
    }

    @AuditLog(module = "因子库", operation = "更新排放因子", resourceType = "EmissionFactor")
    @Transactional
    @CacheEvict(value = "factors", allEntries = true)
    public EmissionFactor update(String id, EmissionFactor factor) {
        EmissionFactor existing = getById(id);
        FactorVersion v = versionRepo.findByLibraryAndVersionCode(existing.getLibrary(), existing.getVersionCode())
                .orElse(null);
        if (v != null && Boolean.TRUE.equals(v.getLocked())) {
            throw new BusinessException(ErrorCode.FACTOR_VERSION_CONFLICT, "版本已锁定，不能修改");
        }
        if (!Objects.equals(existing.getFactorValue(), factor.getFactorValue())
                || !Objects.equals(existing.getFactorUnit(), factor.getFactorUnit())) {
            recordChangeLog(existing, factor);
        }
        org.springframework.beans.BeanUtils.copyProperties(factor, existing,
                "id", "tenantId", "createdAt", "createdBy", "library", "matchKey", "versionCode");
        return factorRepo.save(existing);
    }

    @Transactional
    @CacheEvict(value = "factors", allEntries = true)
    public void delete(String id) {
        factorRepo.deleteById(id);
    }

    @AuditLog(module = "因子库", operation = "创建因子版本", resourceType = "FactorVersion")
    @Transactional
    @CacheEvict(value = "factors", allEntries = true)
    public FactorVersion createVersion(FactorVersion version) {
        versionRepo.findByLibraryAndVersionCode(version.getLibrary(), version.getVersionCode())
                .ifPresent(v -> {
                    throw new BusinessException(ErrorCode.FACTOR_VERSION_CONFLICT,
                            "版本已存在: " + v.getVersionCode());
                });
        return versionRepo.save(version);
    }

    @AuditLog(module = "因子库", operation = "锁定因子版本", resourceType = "FactorVersion")
    @Transactional
    @CacheEvict(value = "factors", allEntries = true)
    public FactorVersion lockVersion(FactorLibrary library, String versionCode) {
        FactorVersion v = versionRepo.findByLibraryAndVersionCode(library, versionCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.FACTOR_VERSION_NOT_FOUND, "版本不存在"));
        v.setLocked(true);
        v.setReviewStatus("APPROVED");
        return versionRepo.save(v);
    }

    public PageResult<FactorVersion> listVersions(FactorLibrary library, PageQuery pq) {
        Page<FactorVersion> page;
        if (library != null) {
            page = versionRepo.findByLibrary(library,
                    PageRequest.of(pq.getPage(), pq.getSize(),
                            Sort.by(Sort.Direction.DESC, "releaseDate")));
        } else {
            page = versionRepo.findAll(PageRequest.of(pq.getPage(), pq.getSize(),
                    Sort.by(Sort.Direction.DESC, "releaseDate")));
        }
        return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
    }

    public FactorVersion getVersion(FactorLibrary library, String versionCode) {
        return versionRepo.findByLibraryAndVersionCode(library, versionCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.FACTOR_VERSION_NOT_FOUND, "版本不存在"));
    }

    @Cacheable(value = "factors", key = "'changelog-'+#library+'-'+#matchKey")
    public List<FactorChangeLog> getChangeLogs(FactorLibrary library, String matchKey) {
        return changeLogRepo.findByLibraryAndMatchKeyOrderByCreatedAtDesc(library, matchKey);
    }

    public PageResult<FactorChangeLog> listChangeLogs(FactorLibrary library, String versionTo, PageQuery pq) {
        Page<FactorChangeLog> page = changeLogRepo.findByLibraryAndVersionTo(library, versionTo,
                PageRequest.of(pq.getPage(), pq.getSize(), Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
    }

    public Map<String, Object> diff(FactorLibrary library, String versionFrom, String versionTo) {
        List<EmissionFactor> oldFactors = factorRepo.findByLibraryAndVersionCode(library, versionFrom);
        List<EmissionFactor> newFactors = factorRepo.findByLibraryAndVersionCode(library, versionTo);
        Map<String, EmissionFactor> oldMap = new HashMap<>();
        for (EmissionFactor f : oldFactors) oldMap.put(key(f), f);
        Map<String, EmissionFactor> newMap = new HashMap<>();
        for (EmissionFactor f : newFactors) newMap.put(key(f), f);

        List<Map<String, Object>> added = new ArrayList<>();
        List<Map<String, Object>> removed = new ArrayList<>();
        List<Map<String, Object>> changed = new ArrayList<>();

        for (Map.Entry<String, EmissionFactor> e : newMap.entrySet()) {
            EmissionFactor oldF = oldMap.get(e.getKey());
            EmissionFactor newF = e.getValue();
            if (oldF == null) {
                added.add(Map.of("matchKey", newF.getMatchKey(),
                        "gas", newF.getGas(), "newValue", newF.getFactorValue()));
            } else if (!Objects.equals(oldF.getFactorValue(), newF.getFactorValue())) {
                BigDecimal delta = newF.getFactorValue().subtract(oldF.getFactorValue());
                BigDecimal deltaPct = oldF.getFactorValue().compareTo(BigDecimal.ZERO) == 0
                        ? null : delta.divide(oldF.getFactorValue(), 6, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100));
                changed.add(Map.of("matchKey", newF.getMatchKey(),
                        "gas", newF.getGas(),
                        "oldValue", oldF.getFactorValue(),
                        "newValue", newF.getFactorValue(),
                        "delta", delta,
                        "deltaPercent", deltaPct));
            }
        }
        for (Map.Entry<String, EmissionFactor> e : oldMap.entrySet()) {
            if (!newMap.containsKey(e.getKey())) {
                removed.add(Map.of("matchKey", e.getValue().getMatchKey(),
                        "gas", e.getValue().getGas(),
                        "oldValue", e.getValue().getFactorValue()));
            }
        }
        return Map.of("library", library, "versionFrom", versionFrom, "versionTo", versionTo,
                "added", added, "removed", removed, "changed", changed,
                "summary", Map.of("addedCount", added.size(),
                        "removedCount", removed.size(),
                        "changedCount", changed.size()));
    }

    public Map<String, Object> stats() {
        Map<String, Object> m = new LinkedHashMap<>();
        for (FactorLibrary lib : FactorLibrary.values()) {
            Optional<FactorVersion> v = versionRepo.findFirstByLibraryOrderByReleaseDateDesc(lib);
            if (v.isEmpty()) continue;
            long total = factorRepo.countByLibraryAndVersionCode(lib, v.get().getVersionCode());
            var byGas = factorRepo.summarizeByGas(lib, v.get().getVersionCode());
            m.put(lib.name(), Map.of("version", v.get().getVersionCode(),
                    "releaseDate", v.get().getReleaseDate(),
                    "total", total,
                    "byGas", byGas));
        }
        return m;
    }

    private Optional<FactorVersion> resolveVersionForPeriod(FactorLibrary library, YearMonth period) {
        List<FactorVersion> versions = versionRepo.findByLibraryOrderByReleaseDateDesc(library);
        LocalDate periodDate = period.atDay(1);
        for (FactorVersion v : versions) {
            if (v.getEffectiveFrom() != null && v.getEffectiveFrom().isAfter(periodDate)) continue;
            if (v.getEffectiveTo() != null && v.getEffectiveTo().isBefore(periodDate)) continue;
            return Optional.of(v);
        }
        return versions.isEmpty() ? Optional.empty() : Optional.of(versions.get(0));
    }

    private void recordChangeLog(EmissionFactor oldF, EmissionFactor newF) {
        FactorChangeLog log = new FactorChangeLog();
        log.setLibrary(oldF.getLibrary());
        log.setVersionFrom(oldF.getVersionCode());
        log.setVersionTo(newF.getVersionCode());
        log.setMatchKey(oldF.getMatchKey());
        log.setFactorCode(oldF.getFactorCode());
        log.setGas(oldF.getGas());
        log.setOldValue(oldF.getFactorValue());
        log.setNewValue(newF.getFactorValue());
        if (oldF.getFactorValue() != null && newF.getFactorValue() != null) {
            BigDecimal delta = newF.getFactorValue().subtract(oldF.getFactorValue());
            log.setDelta(delta);
            if (oldF.getFactorValue().compareTo(BigDecimal.ZERO) != 0) {
                log.setDeltaPercent(delta.divide(oldF.getFactorValue(), 6, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)));
            }
        }
        log.setOldUnit(oldF.getFactorUnit());
        log.setNewUnit(newF.getFactorUnit());
        log.setChangeType("UPDATE");
        changeLogRepo.save(log);
    }

    private String key(EmissionFactor f) {
        return f.getMatchKey() + "|" + (f.getGas() != null ? f.getGas().name() : "");
    }
}
