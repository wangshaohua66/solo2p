package com.court.execution.repository;

import com.court.execution.entity.DistributionDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DistributionDetailRepository extends JpaRepository<DistributionDetail, Long> {

    List<DistributionDetail> findByDistributionPlanIdOrderByPriorityOrder(Long planId);

    long countByDistributionPlanId(Long planId);

    @Query("SELECT COALESCE(SUM(d.actualAmount), 0) FROM DistributionDetail d WHERE d.payStatus = 'PAID'")
    BigDecimal sumAllPaidAmount();

    @Query("SELECT COALESCE(SUM(d.actualAmount), 0) FROM DistributionDetail d WHERE d.payStatus = 'PAID' AND d.payTime BETWEEN :startDate AND :endDate")
    BigDecimal sumPaidAmountByPayTimeBetween(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    @Query("SELECT COALESCE(SUM(d.actualAmount), 0) FROM DistributionDetail d WHERE d.distributionPlan.executionCase.id = :caseId AND d.payStatus = 'PAID'")
    BigDecimal sumPaidAmountByCaseId(@Param("caseId") Long caseId);
}
