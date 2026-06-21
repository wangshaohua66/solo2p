package com.court.execution.service;

import com.court.execution.entity.*;
import com.court.execution.repository.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class StatisticsService {

    private final ExecutionCaseRepository caseRepository;
    private final PropertyRepository propertyRepository;
    private final SeizureRecordRepository seizureRepository;
    private final AuctionRepository auctionRepository;
    private final FundRecordRepository fundRepository;
    private final DistributionDetailRepository distributionDetailRepository;
    private final CoordinationLetterRepository letterRepository;

    public StatisticsService(ExecutionCaseRepository caseRepository,
                             PropertyRepository propertyRepository,
                             SeizureRecordRepository seizureRepository,
                             AuctionRepository auctionRepository,
                             FundRecordRepository fundRepository,
                             DistributionDetailRepository distributionDetailRepository,
                             CoordinationLetterRepository letterRepository) {
        this.caseRepository = caseRepository;
        this.propertyRepository = propertyRepository;
        this.seizureRepository = seizureRepository;
        this.auctionRepository = auctionRepository;
        this.fundRepository = fundRepository;
        this.distributionDetailRepository = distributionDetailRepository;
        this.letterRepository = letterRepository;
    }

    public Map<String, Object> getOverview() {
        Map<String, Object> result = new HashMap<>();

        result.put("totalCases", caseRepository.count());
        result.put("filingCases", caseRepository.countByStatus(CaseStatus.FILING));
        result.put("investigationCases", caseRepository.countByStatus(CaseStatus.INVESTIGATION));
        result.put("disposalCases", caseRepository.countByStatus(CaseStatus.DISPOSAL));
        result.put("distributionCases", caseRepository.countByStatus(CaseStatus.DISTRIBUTION));
        result.put("closedCases", caseRepository.countByStatus(CaseStatus.CLOSED));

        result.put("totalProperties", propertyRepository.count());
        result.put("seizedProperties", propertyRepository.countBySeizedTrue());

        result.put("totalAuctions", auctionRepository.count());
        result.put("soldAuctions", auctionRepository.countByStatus(AuctionStatus.SOLD));
        result.put("failedAuctions", auctionRepository.countByStatus(AuctionStatus.FAILED));

        result.put("totalLetters", letterRepository.count());
        result.put("sentLetters", letterRepository.countByStatus("SENT"));
        result.put("feedbackLetters", letterRepository.countByStatus("FEEDBACK"));

        result.put("fundReceivedTotal", fundRepository.sumByReceivedDateBetween(
                LocalDateTime.of(2000, 1, 1, 0, 0),
                LocalDateTime.now()
        ));
        result.put("fundDistributedTotal", distributionDetailRepository.sumAllPaidAmount());

        return result;
    }

    public Map<String, Object> getJudgeStatistics(Long judgeId) {
        Map<String, Object> result = new HashMap<>();

        User judge = null;
        long totalCases = 0;
        long closedCases = 0;

        if (judgeId != null) {
            List<Object[]> judgeStats = caseRepository.countByJudge();
            List<Object[]> closedStats = caseRepository.countClosedByJudge();

            for (Object[] stat : judgeStats) {
                Long id = (Long) stat[0];
                if (id.equals(judgeId)) {
                    totalCases = (Long) stat[2];
                    break;
                }
            }

            for (Object[] stat : closedStats) {
                Long id = (Long) stat[0];
                if (id.equals(judgeId)) {
                    closedCases = (Long) stat[2];
                    break;
                }
            }
        } else {
            totalCases = caseRepository.count();
            closedCases = caseRepository.countByStatus(CaseStatus.CLOSED);
        }

        result.put("totalCases", totalCases);
        result.put("closedCases", closedCases);
        result.put("closeRate", totalCases > 0 ? (double) closedCases / totalCases * 100 : 0);

        return result;
    }

    public Map<String, Object> getTimeRangeStatistics(LocalDateTime startDate, LocalDateTime endDate) {
        Map<String, Object> result = new HashMap<>();

        result.put("newCases", caseRepository.countByFilingDateBetween(startDate, endDate));
        result.put("seizureCount", seizureRepository.countByStartDateBetween(startDate, endDate));
        result.put("soldAuctions", auctionRepository.countSoldByDateRange(startDate, endDate));
        result.put("auctionAmount", auctionRepository.sumSoldAmountByDateRange(startDate, endDate));

        result.put("fundCount", fundRepository.countByReceivedDateBetween(startDate, endDate));
        result.put("fundReceivedTotal", fundRepository.sumByReceivedDateBetween(startDate, endDate));
        result.put("fundDistributedTotal", distributionDetailRepository.sumPaidAmountByPayTimeBetween(startDate, endDate));

        result.put("letterCount", letterRepository.countByCreateTimeBetween(startDate, endDate));

        return result;
    }

    public List<Object[]> getJudgeCaseStatistics() {
        return caseRepository.countByJudge();
    }

    public List<Object[]> getJudgeCloseRateStatistics() {
        return caseRepository.countClosedByJudge();
    }

    public List<Object[]> getPropertyTypeStatistics() {
        return propertyRepository.countByPropertyType();
    }

    public Map<String, BigDecimal> getAuctionStatistics(LocalDateTime startDate, LocalDateTime endDate) {
        Map<String, BigDecimal> result = new HashMap<>();
        result.put("totalAmount", auctionRepository.sumSoldAmountByDateRange(startDate, endDate));
        result.put("totalCount", BigDecimal.valueOf(auctionRepository.countSoldByDateRange(startDate, endDate)));
        return result;
    }
}
