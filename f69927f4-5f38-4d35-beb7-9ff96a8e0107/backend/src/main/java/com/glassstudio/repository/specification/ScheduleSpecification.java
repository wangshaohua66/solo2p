package com.glassstudio.repository.specification;

import com.glassstudio.entity.Member;
import com.glassstudio.entity.Schedule;
import com.glassstudio.entity.ScheduleStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class ScheduleSpecification {

    public static Specification<Schedule> withKilnId(Long kilnId) {
        return (root, query, criteriaBuilder) -> {
            if (kilnId == null) {
                return criteriaBuilder.conjunction();
            }
            return criteriaBuilder.equal(root.get("kilnId"), kilnId);
        };
    }

    public static Specification<Schedule> withMemberId(Long memberId) {
        return (root, query, criteriaBuilder) -> {
            if (memberId == null) {
                return criteriaBuilder.conjunction();
            }
            return criteriaBuilder.equal(root.get("memberId"), memberId);
        };
    }

    public static Specification<Schedule> withStatus(ScheduleStatus status) {
        return (root, query, criteriaBuilder) -> {
            if (status == null) {
                return criteriaBuilder.conjunction();
            }
            return criteriaBuilder.equal(root.get("status"), status);
        };
    }

    public static Specification<Schedule> withStartTimeBetween(LocalDateTime start, LocalDateTime end) {
        return (root, query, criteriaBuilder) -> {
            if (start == null && end == null) {
                return criteriaBuilder.conjunction();
            }
            List<Predicate> predicates = new ArrayList<>();
            if (start != null) {
                predicates.add(criteriaBuilder.greaterThan(root.get("endTime"), start));
            }
            if (end != null) {
                predicates.add(criteriaBuilder.lessThan(root.get("startTime"), end));
            }
            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    public static Specification<Schedule> withMemberNameLike(String name) {
        return (root, query, criteriaBuilder) -> {
            if (name == null || name.trim().isEmpty()) {
                return criteriaBuilder.conjunction();
            }
            Join<Schedule, Member> memberJoin = root.join("member");
            return criteriaBuilder.like(memberJoin.get("realName"), "%" + name + "%");
        };
    }

    public static Specification<Schedule> buildSpecification(Long kilnId, Long memberId, ScheduleStatus status,
                                                              LocalDateTime startDate, LocalDateTime endDate,
                                                              String memberName) {
        return Specification.where(withKilnId(kilnId))
                .and(withMemberId(memberId))
                .and(withStatus(status))
                .and(withStartTimeBetween(startDate, endDate))
                .and(withMemberNameLike(memberName));
    }
}
