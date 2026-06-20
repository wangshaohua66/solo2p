package com.notarization.service;

import com.notarization.model.StatisticRecord;

import java.time.LocalDate;
import java.util.List;

public interface StatisticService {

    StatisticRecord generateDailyStatistic();

    StatisticRecord generateMonthlyStatistic();

    StatisticRecord generateQuarterlyStatistic();

    List<StatisticRecord> getStatistics(String periodType, LocalDate start, LocalDate end);

    StatisticRecord getLatestStatistic(String periodType);
}
