package com.tvstation.media.repository;

import com.tvstation.media.entity.Copyright;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface CopyrightRepository extends JpaRepository<Copyright, Long>, JpaSpecificationExecutor<Copyright> {

    Page<Copyright> findByStatusAndDeletedFalse(Copyright.CopyrightStatus status, Pageable pageable);

    @Query("SELECT c FROM Copyright c WHERE c.deleted = false AND " +
           "c.endDate <= :expiryDate AND c.status != 'expired'")
    List<Copyright> findExpiringCopyrights(@Param("expiryDate") LocalDate expiryDate);

    @Query("SELECT c FROM Copyright c WHERE c.deleted = false AND " +
           "(:status IS NULL OR c.status = :status) AND " +
           "(:keyword IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(c.owner) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<Copyright> findByFilters(
            @Param("status") Copyright.CopyrightStatus status,
            @Param("keyword") String keyword,
            Pageable pageable);

    @Query("SELECT c.status, COUNT(c) FROM Copyright c WHERE c.deleted = false GROUP BY c.status")
    List<Object[]> countByStatus();

    @Query("SELECT COALESCE(SUM(c.cost), 0) FROM Copyright c WHERE c.deleted = false")
    BigDecimal sumTotalCost();

    @Query("SELECT c FROM Copyright c WHERE c.deleted = false AND " +
           "c.endDate >= :startDate AND c.endDate <= :endDate")
    List<Copyright> findByExpiryDateRange(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT COUNT(c) > 0 FROM Copyright c JOIN c.materialIds m " +
           "WHERE c.deleted = false AND m = :materialId AND c.status = 'active'")
    boolean hasActiveCopyrightForMaterial(@Param("materialId") Long materialId);
}
