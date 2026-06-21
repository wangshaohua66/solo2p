package com.court.execution.repository;

import com.court.execution.entity.DistributionPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DistributionPlanRepository extends JpaRepository<DistributionPlan, Long> {

    List<DistributionPlan> findByExecutionCaseIdOrderByCreateTimeDesc(Long caseId);

    Optional<DistributionPlan> findByPlanNumber(String planNumber);

    boolean existsByPlanNumber(String planNumber);

    List<DistributionPlan> findByStatus(String status);

    @Query("SELECT CASE WHEN COUNT(dp) > 0 THEN true ELSE false END FROM DistributionPlan dp WHERE dp.executionCase.id = :caseId AND dp.status = 'COMPLETED'")
    boolean hasCompletedPlanByCaseId(@Param("caseId") Long caseId);
}
