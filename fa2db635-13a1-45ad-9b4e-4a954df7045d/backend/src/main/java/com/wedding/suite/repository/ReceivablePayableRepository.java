package com.wedding.suite.repository;

import com.wedding.suite.entity.ReceivablePayableEntity;
import com.wedding.suite.enums.FinanceType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReceivablePayableRepository extends JpaRepository<ReceivablePayableEntity, Long> {
    List<ReceivablePayableEntity> findByTypeAndSettledFalse(FinanceType type);
    List<ReceivablePayableEntity> findBySettledFalse();
}
