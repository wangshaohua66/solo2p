package com.court.execution.repository;

import com.court.execution.entity.BidRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BidRecordRepository extends JpaRepository<BidRecord, Long> {

    List<BidRecord> findByAuctionIdOrderByBidTimeDesc(Long auctionId);

    List<BidRecord> findByAuctionIdOrderByBidAmountDesc(Long auctionId);

    long countByAuctionId(Long auctionId);
}
