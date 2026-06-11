package com.glassstudio.repository;

import com.glassstudio.entity.FiringCurve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FiringCurveRepository extends JpaRepository<FiringCurve, Long> {

    List<FiringCurve> findByIsTemplateTrue();

    List<FiringCurve> findByCreatedBy(Long createdBy);
}
