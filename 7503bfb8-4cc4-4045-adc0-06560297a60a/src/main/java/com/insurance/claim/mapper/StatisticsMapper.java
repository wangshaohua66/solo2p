package com.insurance.claim.mapper;

import com.insurance.claim.dto.response.StatisticsResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.time.LocalDate;
import java.util.List;

@Mapper
public interface StatisticsMapper {

    Long countTotalClaims(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    Long countClosedClaims(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    java.math.BigDecimal sumTotalPayments(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    java.math.BigDecimal calculateAverageSettlementDays(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    Long countPendingClaims();

    Long countCancelledClaims(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    Long countFraudSuspiciousClaims(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    List<StatisticsResponse.InsuranceStatistics> getInsuranceStatistics(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    List<StatisticsResponse.BranchStatistics> getBranchStatistics(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    List<StatisticsResponse.MonthlyTrend> getMonthlyTrends(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}
