package com.wedding.suite.repository;

import com.wedding.suite.entity.ContractEntity;
import com.wedding.suite.enums.ContractStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContractRepository extends JpaRepository<ContractEntity, Long> {
    List<ContractEntity> findByStatus(ContractStatus status);
    List<ContractEntity> findByWeddingId(Long weddingId);
    long countByStatus(ContractStatus status);
}
