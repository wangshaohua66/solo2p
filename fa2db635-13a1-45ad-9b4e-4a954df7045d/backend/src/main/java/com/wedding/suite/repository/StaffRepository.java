package com.wedding.suite.repository;

import com.wedding.suite.entity.StaffEntity;
import com.wedding.suite.enums.StaffRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StaffRepository extends JpaRepository<StaffEntity, Long> {
    List<StaffEntity> findByStoreId(Long storeId);
    List<StaffEntity> findByStoreIdAndRole(Long storeId, StaffRole role);
    StaffEntity findByPhone(String phone);
}
