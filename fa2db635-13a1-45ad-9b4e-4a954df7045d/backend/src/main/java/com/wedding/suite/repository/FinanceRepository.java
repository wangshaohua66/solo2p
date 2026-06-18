package com.wedding.suite.repository;

import com.wedding.suite.entity.FinanceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FinanceRepository extends JpaRepository<FinanceEntity, Long> {
    Optional<FinanceEntity> findByWeddingId(Long weddingId);
}
