package com.insurance.claim.service;

import com.insurance.claim.dto.response.StatisticsResponse;
import com.insurance.claim.mapper.StatisticsMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatisticsService {

    private final StatisticsMapper statisticsMapper;

    public StatisticsResponse getMonthlyStatistics(int year, int month) {
        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = startDate.plusMonths(1).minusDays(1);

        return buildStatisticsResponse("month", startDate, endDate);
    }

    public StatisticsResponse getYearlyStatistics(int year) {
        LocalDate startDate = LocalDate.of(year, 1, 1);
        LocalDate endDate = LocalDate.of(year, 12, 31);

        return buildStatisticsResponse("year", startDate, endDate);
    }

    public StatisticsResponse getDateRangeStatistics(LocalDate startDate, LocalDate endDate) {
        return buildStatisticsResponse("custom", startDate, endDate);
    }

    private StatisticsResponse buildStatisticsResponse(String dimension, LocalDate startDate, LocalDate endDate) {
        log.info("统计查询: 维度={}, 开始={}, 结束={}", dimension, startDate, endDate);

        StatisticsResponse response = new StatisticsResponse();
        response.setDimension(dimension);
        response.setStartDate(startDate.toString());
        response.setEndDate(endDate.toString());

        Long totalClaimCount = statisticsMapper.countTotalClaims(startDate, endDate);
        response.setTotalClaimCount(totalClaimCount);

        Long closedClaimCount = statisticsMapper.countClosedClaims(startDate, endDate);
        response.setClosedClaimCount(closedClaimCount);

        if (totalClaimCount > 0) {
            BigDecimal closureRate = BigDecimal.valueOf(closedClaimCount)
                    .divide(BigDecimal.valueOf(totalClaimCount), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
            response.setClosureRate(closureRate);
        } else {
            response.setClosureRate(BigDecimal.ZERO);
        }

        BigDecimal totalPaymentAmount = statisticsMapper.sumTotalPayments(startDate, endDate);
        response.setTotalPaymentAmount(totalPaymentAmount != null ? totalPaymentAmount : BigDecimal.ZERO);

        if (closedClaimCount > 0 && totalPaymentAmount != null) {
            BigDecimal averagePayment = totalPaymentAmount
                    .divide(BigDecimal.valueOf(closedClaimCount), 2, RoundingMode.HALF_UP);
            response.setAveragePaymentAmount(averagePayment);
        } else {
            response.setAveragePaymentAmount(BigDecimal.ZERO);
        }

        BigDecimal avgSettlementDays = statisticsMapper.calculateAverageSettlementDays(startDate, endDate);
        response.setAverageSettlementDays(avgSettlementDays != null ? avgSettlementDays : BigDecimal.ZERO);

        response.setPendingClaimCount(statisticsMapper.countPendingClaims());
        response.setCancelledClaimCount(statisticsMapper.countCancelledClaims(startDate, endDate));
        response.setFraudSuspiciousCount(statisticsMapper.countFraudSuspiciousClaims(startDate, endDate));

        List<StatisticsResponse.InsuranceStatistics> insuranceStats = statisticsMapper.getInsuranceStatistics(startDate, endDate);
        response.setInsuranceStatistics(insuranceStats);

        List<StatisticsResponse.BranchStatistics> branchStats = statisticsMapper.getBranchStatistics(startDate, endDate);
        response.setBranchStatistics(branchStats);

        List<StatisticsResponse.MonthlyTrend> monthlyTrends = statisticsMapper.getMonthlyTrends(startDate, endDate);
        response.setMonthlyTrends(monthlyTrends);

        return response;
    }

    public List<StatisticsResponse.InsuranceStatistics> getInsuranceStatistics(LocalDate startDate, LocalDate endDate) {
        return statisticsMapper.getInsuranceStatistics(startDate, endDate);
    }

    public List<StatisticsResponse.BranchStatistics> getBranchStatistics(LocalDate startDate, LocalDate endDate) {
        return statisticsMapper.getBranchStatistics(startDate, endDate);
    }

    public List<StatisticsResponse.MonthlyTrend> getMonthlyTrends(LocalDate startDate, LocalDate endDate) {
        return statisticsMapper.getMonthlyTrends(startDate, endDate);
    }
}
