package com.carbon.emission.service;

import com.carbon.common.api.ErrorCode;
import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.audit.AuditLog;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.enums.ScopeType;
import com.carbon.common.exception.BusinessException;
import com.carbon.common.exception.NotFoundException;
import com.carbon.emission.entity.EmissionSource;
import com.carbon.emission.repository.EmissionSourceRepository;
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

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmissionSourceService {

    private final EmissionSourceRepository repository;
    private final MongoTemplate mongoTemplate;

    @AuditLog(module = "排放源", operation = "创建排放源", resourceType = "EmissionSource")
    @Transactional
    @CacheEvict(value = "emissionSources", allEntries = true)
    public EmissionSource create(EmissionSource source) {
        String tenantId = UserContextHolder.getTenantId();
        source.setTenantId(tenantId);
        source.setDeleted(false);
        if (source.getStatus() == null) source.setStatus("ACTIVE");
        repository.findByTenantIdAndCode(tenantId, source.getCode())
                .ifPresent(s -> {
                    throw new BusinessException(ErrorCode.EMISSION_SOURCE_DUPLICATED,
                            "排放源编码已存在: " + source.getCode());
                });
        return repository.save(source);
    }

    @AuditLog(module = "排放源", operation = "更新排放源", resourceType = "EmissionSource")
    @Transactional
    @CacheEvict(value = "emissionSources", allEntries = true)
    public EmissionSource update(String id, EmissionSource source) {
        EmissionSource existing = mustGet(id);
        org.springframework.beans.BeanUtils.copyProperties(source, existing,
                "id", "tenantId", "createdAt", "createdBy", "deleted");
        return repository.save(existing);
    }

    @AuditLog(module = "排放源", operation = "删除排放源", resourceType = "EmissionSource")
    @Transactional
    @CacheEvict(value = "emissionSources", allEntries = true)
    public void delete(String id) {
        EmissionSource existing = mustGet(id);
        existing.setDeleted(true);
        existing.setStatus("DELETED");
        repository.save(existing);
    }

    @Cacheable(value = "emissionSources", key = "#id")
    public EmissionSource getById(String id) {
        return mustGet(id);
    }

    @Cacheable(value = "emissionSources", key = "'code-'+#code")
    public Optional<EmissionSource> getByCode(String code) {
        return repository.findByTenantIdAndCode(UserContextHolder.getTenantId(), code);
    }

    public PageResult<EmissionSource> list(ScopeType scope, String keyword,
                                           String status, PageQuery pageQuery) {
        String tenantId = UserContextHolder.getTenantId();
        Sort sort = pageQuery.getSortBy() != null
                ? Sort.by(Sort.Direction.fromString(pageQuery.getSortDirection()), pageQuery.getSortBy())
                : Sort.by(Sort.Direction.DESC, "createdAt");
        PageRequest pageable = PageRequest.of(pageQuery.getPage(), pageQuery.getSize(), sort);

        Page<EmissionSource> page;
        if (keyword != null && !keyword.isBlank()) {
            page = repository.search(tenantId, keyword, pageable);
        } else if (scope != null) {
            page = repository.findByTenantIdAndScope(tenantId, scope, pageable);
        } else if (status != null) {
            page = repository.findByTenantIdAndStatus(tenantId, status, pageable);
        } else {
            Query q = new Query(Criteria.where("tenantId").is(tenantId)).with(pageable);
            List<EmissionSource> list = mongoTemplate.find(q, EmissionSource.class);
            long total = mongoTemplate.count(Query.of(q).limit(-1).skip(-1), EmissionSource.class);
            return PageResult.of(list, pageQuery.getPage(), pageQuery.getSize(), total);
        }
        return PageResult.of(page.getContent(), pageQuery.getPage(), pageQuery.getSize(), page.getTotalElements());
    }

    public List<EmissionSource> listBrief() {
        return repository.findBriefByTenantId(UserContextHolder.getTenantId());
    }

    public java.util.Map<String, Object> stats() {
        String tenantId = UserContextHolder.getTenantId();
        return java.util.Map.of(
                "total", repository.countByTenantId(tenantId),
                "scope1", repository.countByTenantIdAndScope(tenantId, ScopeType.SCOPE_1),
                "scope2", repository.countByTenantIdAndScope(tenantId, ScopeType.SCOPE_2),
                "scope3", repository.countByTenantIdAndScope(tenantId, ScopeType.SCOPE_3),
                "active", repository.countByTenantIdAndStatus(tenantId, "ACTIVE")
        );
    }

    public EmissionSource mustGet(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("排放源", id));
    }

    @AuditLog(module = "排放源", operation = "批量导入排放源", resourceType = "EmissionSource")
    @Transactional
    public java.util.Map<String, Object> batchImport(List<EmissionSource> sources) {
        String tenantId = UserContextHolder.getTenantId();
        int inserted = 0, updated = 0, failed = 0;
        for (EmissionSource s : sources) {
            try {
                s.setTenantId(tenantId);
                s.setDeleted(false);
                if (s.getStatus() == null) s.setStatus("ACTIVE");
                Optional<EmissionSource> existing = repository.findByTenantIdAndCode(tenantId, s.getCode());
                if (existing.isPresent()) {
                    s.setId(existing.get().getId());
                    repository.save(s);
                    updated++;
                } else {
                    repository.save(s);
                    inserted++;
                }
            } catch (Exception e) {
                failed++;
                log.warn("Batch import source failed code={}: {}", s.getCode(), e.getMessage());
            }
        }
        return java.util.Map.of("inserted", inserted, "updated", updated, "failed", failed, "total", sources.size());
    }
}
