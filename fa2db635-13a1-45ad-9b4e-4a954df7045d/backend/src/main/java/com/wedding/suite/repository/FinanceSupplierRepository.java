package com.wedding.suite.repository;

import com.wedding.suite.entity.FinanceSupplierEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FinanceSupplierRepository extends JpaRepository<FinanceSupplierEntity, Long> {
    List<FinanceSupplierEntity> findByFinanceId(Long financeId);
}
