package com.glassstudio.repository;

import com.glassstudio.entity.FiringCurve;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FiringCurveRepository extends JpaRepository<FiringCurve, Long> {

    List<FiringCurve> findByIsTemplateTrue();

    List<FiringCurve> findByCreatedBy(Long createdBy);

    Page<FiringCurve> findByNameContaining(String name, Pageable pageable);

    Page<FiringCurve> findByIsTemplate(Boolean isTemplate, Pageable pageable);

    Page<FiringCurve> findByNameContainingAndIsTemplate(String name, Boolean isTemplate, Pageable pageable);
}
