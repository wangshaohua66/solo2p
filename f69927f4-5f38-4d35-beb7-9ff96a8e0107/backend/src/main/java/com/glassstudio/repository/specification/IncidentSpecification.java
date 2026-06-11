package com.glassstudio.repository.specification;

import com.glassstudio.entity.Incident;
import com.glassstudio.entity.IncidentSeverity;
import com.glassstudio.entity.IncidentType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class IncidentSpecification {

    public static Specification<Incident> withMemberId(Long memberId) {
        return (root, query, criteriaBuilder) -> {
            if (memberId == null) {
                return criteriaBuilder.conjunction();
            }
            return criteriaBuilder.equal(root.get("memberId"), memberId);
        };
    }

    public static Specification<Incident> withType(IncidentType type) {
        return (root, query, criteriaBuilder) -> {
            if (type == null) {
                return criteriaBuilder.conjunction();
            }
            return criteriaBuilder.equal(root.get("type"), type);
        };
    }

    public static Specification<Incident> withSeverity(IncidentSeverity severity) {
        return (root, query, criteriaBuilder) -> {
            if (severity == null) {
                return criteriaBuilder.conjunction();
            }
            return criteriaBuilder.equal(root.get("severity"), severity);
        };
    }

    public static Specification<Incident> withResolved(Boolean resolved) {
        return (root, query, criteriaBuilder) -> {
            if (resolved == null) {
                return criteriaBuilder.conjunction();
            }
            return criteriaBuilder.equal(root.get("resolved"), resolved);
        };
    }

    public static Specification<Incident> withKilnOpenRecordId(Long kilnOpenRecordId) {
        return (root, query, criteriaBuilder) -> {
            if (kilnOpenRecordId == null) {
                return criteriaBuilder.conjunction();
            }
            return criteriaBuilder.equal(root.get("kilnOpenRecordId"), kilnOpenRecordId);
        };
    }

    public static Specification<Incident> withCreatedAtBetween(LocalDateTime start, LocalDateTime end) {
        return (root, query, criteriaBuilder) -> {
            if (start == null && end == null) {
                return criteriaBuilder.conjunction();
            }
            List<Predicate> predicates = new ArrayList<>();
            if (start != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("createdAt"), start));
            }
            if (end != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("createdAt"), end));
            }
            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    public static Specification<Incident> buildSpecification(Long memberId, IncidentType type,
                                                              IncidentSeverity severity, Boolean resolved,
                                                              Long kilnOpenRecordId, LocalDateTime startDate,
                                                              LocalDateTime endDate) {
        return Specification.where(withMemberId(memberId))
                .and(withType(type))
                .and(withSeverity(severity))
                .and(withResolved(resolved))
                .and(withKilnOpenRecordId(kilnOpenRecordId))
                .and(withCreatedAtBetween(startDate, endDate));
    }
}
