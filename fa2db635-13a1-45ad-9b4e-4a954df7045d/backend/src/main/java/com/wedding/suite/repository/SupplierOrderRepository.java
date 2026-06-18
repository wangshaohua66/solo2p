package com.wedding.suite.repository;

import com.wedding.suite.entity.SupplierOrderEntity;
import com.wedding.suite.enums.SupplierOrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SupplierOrderRepository extends JpaRepository<SupplierOrderEntity, Long> {
    List<SupplierOrderEntity> findByStaffId(Long staffId);
    List<SupplierOrderEntity> findByStatus(SupplierOrderStatus status);
}
