package com.glassstudio.repository;

import com.glassstudio.entity.Batch;
import com.glassstudio.entity.BatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface BatchRepository extends JpaRepository<Batch, Long> {

    List<Batch> findByStatusAndExpiryDateBefore(BatchStatus status, LocalDate date);

    List<Batch> findByStatus(BatchStatus status);

    List<Batch> findByMaterialNameContaining(String materialName);

    Batch findTopByMaterialNameAndStatusOrderByCreatedAtAsc(String materialName, BatchStatus status);
}
