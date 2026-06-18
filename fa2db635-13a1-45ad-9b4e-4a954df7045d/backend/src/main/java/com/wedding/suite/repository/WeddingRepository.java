package com.wedding.suite.repository;

import com.wedding.suite.entity.WeddingEntity;
import com.wedding.suite.enums.WeddingStage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface WeddingRepository extends JpaRepository<WeddingEntity, Long> {
    List<WeddingEntity> findByStage(WeddingStage stage);
    List<WeddingEntity> findByStoreId(Long storeId);
    List<WeddingEntity> findByWeddingDate(LocalDate weddingDate);
    List<WeddingEntity> findByCoupleNameContaining(String keyword);
    long countByStage(WeddingStage stage);
}
