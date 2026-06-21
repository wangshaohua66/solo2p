package com.court.execution.repository;

import com.court.execution.entity.Auction;
import com.court.execution.entity.AuctionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuctionRepository extends JpaRepository<Auction, Long> {

    List<Auction> findByExecutionCaseIdOrderByCreateTimeDesc(Long caseId);

    Page<Auction> findByExecutionCaseId(Long caseId, Pageable pageable);

    List<Auction> findByPropertyId(Long propertyId);

    Page<Auction> findByStatus(AuctionStatus status, Pageable pageable);

    @Query("SELECT COUNT(a) FROM Auction a WHERE a.status = 'SOLD' AND a.dealTime BETWEEN :startDate AND :endDate")
    long countSoldByDateRange(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    @Query("SELECT COALESCE(SUM(a.finalPrice), 0) FROM Auction a WHERE a.status = 'SOLD' AND a.dealTime BETWEEN :startDate AND :endDate")
    java.math.BigDecimal sumSoldAmountByDateRange(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    long countByStatus(AuctionStatus status);
}
