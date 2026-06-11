package com.scriptkill.repository;

import com.scriptkill.entity.Purchase;
import com.scriptkill.entity.enums.PurchaseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseRepository extends JpaRepository<Purchase, Long> {

    Page<Purchase> findByStatus(PurchaseStatus status, Pageable pageable);

    List<Purchase> findByStatus(PurchaseStatus status);

    List<Purchase> findBySubmitterId(Long submitterId);

    List<Purchase> findByStatusOrderByCreatedAtDesc(PurchaseStatus status);
}
