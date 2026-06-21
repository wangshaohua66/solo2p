package com.court.execution.repository;

import com.court.execution.entity.DistributionDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DistributionDetailRepository extends JpaRepository<DistributionDetail, Long> {

    List<DistributionDetail> findByDistributionPlanIdOrderByPriorityOrder(Long planId);

    long countByDistributionPlanId(Long planId);
}
