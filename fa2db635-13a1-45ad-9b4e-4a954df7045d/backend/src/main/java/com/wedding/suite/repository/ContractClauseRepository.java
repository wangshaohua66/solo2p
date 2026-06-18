package com.wedding.suite.repository;

import com.wedding.suite.entity.ContractClauseEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContractClauseRepository extends JpaRepository<ContractClauseEntity, Long> {
    List<ContractClauseEntity> findByContractId(Long contractId);
    void deleteByContractId(Long contractId);
}
