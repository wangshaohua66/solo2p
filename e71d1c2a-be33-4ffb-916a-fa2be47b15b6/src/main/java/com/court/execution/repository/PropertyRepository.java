package com.court.execution.repository;

import com.court.execution.entity.Property;
import com.court.execution.entity.PropertyType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PropertyRepository extends JpaRepository<Property, Long> {

    List<Property> findByExecutionCaseId(Long caseId);

    Page<Property> findByExecutionCaseId(Long caseId, Pageable pageable);

    List<Property> findByPropertyType(PropertyType propertyType);

    long countBySeizedTrue();

    long countByExecutionCaseId(Long caseId);

    @Query("SELECT p FROM Property p WHERE p.seized = true AND p.seizeExpireDate IS NOT NULL " +
           "AND p.seizeExpireDate BETWEEN :startDate AND :endDate ORDER BY p.seizeExpireDate ASC")
    List<Property> findSeizedPropertiesExpiringBetween(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    @Query("SELECT p FROM Property p WHERE p.seized = true AND p.seizeExpireDate IS NOT NULL " +
           "AND p.seizeExpireDate <= :date ORDER BY p.seizeExpireDate ASC")
    List<Property> findExpiredSeizedProperties(@Param("date") LocalDateTime date);

    @Query("SELECT p.propertyType, COUNT(p) FROM Property p GROUP BY p.propertyType")
    List<Object[]> countByPropertyType();
}
