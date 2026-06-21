package com.court.execution.service;

import com.court.execution.entity.*;
import com.court.execution.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class AuctionService {

    private final AuctionRepository auctionRepository;
    private final BidRecordRepository bidRepository;
    private final PropertyRepository propertyRepository;
    private final ExecutionCaseRepository caseRepository;
    private final UserRepository userRepository;

    private int auctionSequence = 1;

    public AuctionService(AuctionRepository auctionRepository,
                          BidRecordRepository bidRepository,
                          PropertyRepository propertyRepository,
                          ExecutionCaseRepository caseRepository,
                          UserRepository userRepository) {
        this.auctionRepository = auctionRepository;
        this.bidRepository = bidRepository;
        this.propertyRepository = propertyRepository;
        this.caseRepository = caseRepository;
        this.userRepository = userRepository;
    }

    private String generateDealNumber() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String seq = String.format("%04d", auctionSequence++);
        return "CZ-" + dateStr + "-" + seq;
    }

    @Transactional
    public Auction createEvaluation(Long propertyId, String evaluationAgency,
                                     BigDecimal evaluationPrice, String specialistUsername) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new RuntimeException("财产不存在"));

        User specialist = userRepository.findByUsername(specialistUsername)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        Auction auction = new Auction();
        auction.setProperty(property);
        auction.setExecutionCase(property.getExecutionCase());
        auction.setAuctionTitle(property.getPropertyName() + " - 司法拍卖");
        auction.setEvaluationAgency(evaluationAgency);
        auction.setEvaluationPrice(evaluationPrice);
        auction.setEvaluationDate(LocalDateTime.now());
        auction.setStatus(AuctionStatus.EVALUATING);
        auction.setAuctionSpecialist(specialist);

        return auctionRepository.save(auction);
    }

    public Auction getAuctionById(Long id) {
        return auctionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("拍卖不存在"));
    }

    public List<Auction> getAuctionsByCaseId(Long caseId) {
        return auctionRepository.findByExecutionCaseIdOrderByCreateTimeDesc(caseId);
    }

    public List<Auction> getAuctionsByPropertyId(Long propertyId) {
        return auctionRepository.findByPropertyId(propertyId);
    }

    public Page<Auction> getAuctionsByStatus(AuctionStatus status, Pageable pageable) {
        return auctionRepository.findByStatus(status, pageable);
    }

    @Transactional
    public Auction publishAuction(Long auctionId, String auctionPlatform,
                                   BigDecimal startingPrice, BigDecimal reservePrice,
                                   BigDecimal bidIncrement, LocalDateTime startTime,
                                   LocalDateTime endTime) {
        Auction auction = getAuctionById(auctionId);

        if (auction.getStatus() != AuctionStatus.EVALUATING) {
            throw new RuntimeException("只有评估中的拍卖才能发布公告");
        }

        auction.setAuctionPlatform(auctionPlatform);
        auction.setStartingPrice(startingPrice);
        auction.setReservePrice(reservePrice);
        auction.setBidIncrement(bidIncrement);
        auction.setStartTime(startTime);
        auction.setEndTime(endTime);
        auction.setAnnounceTime(LocalDateTime.now());
        auction.setStatus(AuctionStatus.ANNOUNCED);

        return auctionRepository.save(auction);
    }

    @Transactional
    public Auction startBidding(Long auctionId) {
        Auction auction = getAuctionById(auctionId);

        if (auction.getStatus() != AuctionStatus.ANNOUNCED) {
            throw new RuntimeException("只有已发布公告的拍卖才能开始竞价");
        }

        auction.setStatus(AuctionStatus.BIDDING);
        return auctionRepository.save(auction);
    }

    @Transactional
    public BidRecord placeBid(Long auctionId, BigDecimal bidAmount,
                               String bidderName, String bidderIdCard, String bidderPhone) {
        Auction auction = getAuctionById(auctionId);

        if (auction.getStatus() != AuctionStatus.BIDDING) {
            throw new RuntimeException("拍卖不在竞价状态");
        }

        List<BidRecord> bids = bidRepository.findByAuctionIdOrderByBidAmountDesc(auctionId);
        BigDecimal currentHighest = bids.isEmpty() ? auction.getStartingPrice() : bids.get(0).getBidAmount();

        if (bidAmount.compareTo(currentHighest.add(auction.getBidIncrement())) < 0) {
            throw new RuntimeException("出价必须高于当前最高价加加价幅度");
        }

        if (auction.getReservePrice() != null && bidAmount.compareTo(auction.getReservePrice()) < 0) {
            throw new RuntimeException("出价不能低于保留价");
        }

        BidRecord bid = new BidRecord();
        bid.setAuction(auction);
        bid.setBidAmount(bidAmount);
        bid.setBidderName(bidderName);
        bid.setBidderIdCard(bidderIdCard);
        bid.setBidderPhone(bidderPhone);

        return bidRepository.save(bid);
    }

    public List<BidRecord> getBidRecords(Long auctionId) {
        return bidRepository.findByAuctionIdOrderByBidTimeDesc(auctionId);
    }

    public BidRecord getHighestBid(Long auctionId) {
        List<BidRecord> bids = bidRepository.findByAuctionIdOrderByBidAmountDesc(auctionId);
        return bids.isEmpty() ? null : bids.get(0);
    }

    @Transactional
    public Auction closeAuction(Long auctionId) {
        Auction auction = getAuctionById(auctionId);

        if (auction.getStatus() != AuctionStatus.BIDDING) {
            throw new RuntimeException("拍卖不在竞价状态");
        }

        BidRecord highestBid = getHighestBid(auctionId);

        if (highestBid == null) {
            auction.setStatus(AuctionStatus.FAILED);
            return auctionRepository.save(auction);
        }

        auction.setStatus(AuctionStatus.SOLD);
        auction.setFinalPrice(highestBid.getBidAmount());
        auction.setBuyerName(highestBid.getBidderName());
        auction.setBuyerIdCard(highestBid.getBidderIdCard());
        auction.setBuyerPhone(highestBid.getBidderPhone());
        auction.setDealTime(LocalDateTime.now());
        auction.setDealDocumentNumber(generateDealNumber());

        return auctionRepository.save(auction);
    }

    @Transactional
    public Auction withdrawAuction(Long auctionId, String reason) {
        Auction auction = getAuctionById(auctionId);

        if (auction.getStatus() == AuctionStatus.SOLD) {
            throw new RuntimeException("已成交的拍卖不能撤回");
        }

        auction.setStatus(AuctionStatus.WITHDRAWN);
        auction.setRemark(reason);

        return auctionRepository.save(auction);
    }

    @Transactional
    public Auction updateEvaluationReport(Long auctionId, String reportUrl) {
        Auction auction = getAuctionById(auctionId);
        auction.setEvaluationReportUrl(reportUrl);
        return auctionRepository.save(auction);
    }

    public long getBidCount(Long auctionId) {
        return bidRepository.countByAuctionId(auctionId);
    }
}
