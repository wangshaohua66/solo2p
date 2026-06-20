package com.tvstation.media.service.impl;

import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.Copyright;
import com.tvstation.media.repository.CopyrightRepository;
import com.tvstation.media.service.CopyrightRiskAssessmentService;
import com.tvstation.media.service.CopyrightService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class CopyrightServiceImpl implements CopyrightService {

    private final CopyrightRepository copyrightRepository;
    private final CopyrightRiskAssessmentService riskAssessmentService;

    @Override
    public PageResult<Copyright> getCopyrights(Copyright.CopyrightStatus status, String keyword,
                                               int page, int pageSize) {
        Specification<Copyright> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (keyword != null && !keyword.isEmpty()) {
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%"),
                        cb.like(cb.lower(root.get("owner")), "%" + keyword.toLowerCase() + "%")
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Copyright> result = copyrightRepository.findAll(spec,
                PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(result.getContent(), result.getTotalElements(), page, pageSize);
    }

    @Override
    public Copyright getCopyrightById(Long id) {
        return copyrightRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Copyright not found with id: " + id));
    }

    @Override
    @Transactional
    public Copyright createCopyright(Copyright copyright, Long userId, String userName) {
        copyright.setStatus(determineStatus(copyright.getStartDate(), copyright.getEndDate()));
        copyright.setCreatedBy(userId);
        copyright.setUpdatedBy(userId);

        Copyright saved = copyrightRepository.save(copyright);
        riskAssessmentService.assessRisk(saved);
        log.info("Copyright created: id={}, name={}", saved.getId(), saved.getName());
        return saved;
    }

    @Override
    @Transactional
    public Copyright updateCopyright(Long id, Copyright copyright, Long userId) {
        Copyright existing = getCopyrightById(id);
        existing.setName(copyright.getName());
        existing.setType(copyright.getType());
        existing.setOwner(copyright.getOwner());
        existing.setAuthorizationScope(copyright.getAuthorizationScope());
        existing.setStartDate(copyright.getStartDate());
        existing.setEndDate(copyright.getEndDate());
        existing.setCost(copyright.getCost());
        existing.setMaterialIds(copyright.getMaterialIds());
        existing.setContractUrl(copyright.getContractUrl());
        existing.setRemarks(copyright.getRemarks());
        existing.setStatus(determineStatus(copyright.getStartDate(), copyright.getEndDate()));
        existing.setUpdatedBy(userId);

        Copyright saved = copyrightRepository.save(existing);
        riskAssessmentService.assessRisk(saved);
        return saved;
    }

    @Override
    @Transactional
    public void deleteCopyright(Long id, Long userId) {
        Copyright copyright = getCopyrightById(id);
        copyright.setDeleted(true);
        copyright.setUpdatedBy(userId);
        copyrightRepository.save(copyright);
    }

    @Override
    public List<Copyright> getExpiringCopyrights(int days) {
        LocalDate today = LocalDate.now();
        LocalDate threshold = today.plusDays(days);
        return copyrightRepository.findByExpiryDateRange(today, threshold);
    }

    @Override
    public Map<String, Object> getCopyrightStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("total", copyrightRepository.countByDeletedFalse());
        stats.put("byStatus", copyrightRepository.countByStatus());
        stats.put("totalCost", copyrightRepository.sumTotalCost());
        stats.put("expiringCount", getExpiringCopyrights(7).size());
        stats.put("highRiskCount", riskAssessmentService.getHighRiskCopyrights().size());
        return stats;
    }

    @Override
    @Transactional
    public Copyright assessRisk(Long id) {
        Copyright copyright = getCopyrightById(id);
        return riskAssessmentService.assessRisk(copyright);
    }

    @Override
    public List<Copyright> getHighRiskCopyrights() {
        return riskAssessmentService.getHighRiskCopyrights();
    }

    @Override
    @Transactional
    public List<Copyright> assessAllRisks() {
        return riskAssessmentService.assessAllRisks();
    }

    @Override
    public Map<String, Object> getRiskStatistics() {
        Map<String, Object> stats = new HashMap<>();
        List<Copyright> highRisk = riskAssessmentService.getHighRiskCopyrights();
        stats.put("highRiskCount", highRisk.size());
        stats.put("highRiskItems", highRisk);

        List<Copyright> all = copyrightRepository.findAll();
        int noneCount = 0, lowCount = 0, mediumCount = 0, highCount = 0, criticalCount = 0;
        for (Copyright c : all) {
            if (c.getDeleted()) continue;
            switch (c.getRiskLevel()) {
                case none -> noneCount++;
                case low -> lowCount++;
                case medium -> mediumCount++;
                case high -> highCount++;
                case critical -> criticalCount++;
            }
        }
        stats.put("noneCount", noneCount);
        stats.put("lowCount", lowCount);
        stats.put("mediumCount", mediumCount);
        stats.put("highCount", highCount);
        stats.put("criticalCount", criticalCount);
        return stats;
    }

    private Copyright.CopyrightStatus determineStatus(LocalDate startDate, LocalDate endDate) {
        LocalDate now = LocalDate.now();
        if (endDate.isBefore(now)) {
            return Copyright.CopyrightStatus.expired;
        } else if (endDate.isBefore(now.plusDays(7))) {
            return Copyright.CopyrightStatus.expiring;
        }
        return Copyright.CopyrightStatus.active;
    }
}
