package com.glassstudio.repository;

import com.glassstudio.entity.MaintenanceOrder;
import com.glassstudio.entity.MaintenanceStatus;
import com.glassstudio.entity.MaintenanceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaintenanceOrderRepository extends JpaRepository<MaintenanceOrder, Long> {

    List<MaintenanceOrder> findByKilnId(Long kilnId);

    List<MaintenanceOrder> findByStatus(MaintenanceStatus status);

    List<MaintenanceOrder> findByType(MaintenanceType type);
}
