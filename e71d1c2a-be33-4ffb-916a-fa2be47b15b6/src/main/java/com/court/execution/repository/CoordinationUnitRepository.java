package com.court.execution.repository;

import com.court.execution.entity.CoordinationUnit;
import com.court.execution.entity.PropertyType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CoordinationUnitRepository extends JpaRepository<CoordinationUnit, Long> {

    List<CoordinationUnit> findByEnabledTrue();

    List<CoordinationUnit> findByPropertyTypeAndEnabledTrue(PropertyType propertyType);

    boolean existsByUnitName(String unitName);
}
