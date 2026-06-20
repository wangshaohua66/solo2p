package com.notarization.controller;

import com.notarization.dto.ApiResponse;
import com.notarization.model.StatisticRecord;
import com.notarization.service.StatisticService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
@Validated
@RequiredArgsConstructor
public class StatisticController {

    private final StatisticService statisticService;

    @GetMapping("/statistics")
    public ApiResponse<List<StatisticRecord>> getStatistics(
            @RequestParam StatisticRecord.PeriodType periodType,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<StatisticRecord> result = statisticService.getStatistics(periodType, startDate, endDate);
        return ApiResponse.success(result);
    }

    @GetMapping("/statistics/latest")
    public ApiResponse<StatisticRecord> getLatestStatistic(
            @RequestParam StatisticRecord.PeriodType periodType) {
        StatisticRecord result = statisticService.getLatestStatistic(periodType);
        return ApiResponse.success(result);
    }

    @PostMapping("/statistics/generate/daily")
    public ApiResponse<StatisticRecord> generateDailyStatistic() {
        StatisticRecord result = statisticService.generateDailyStatistic();
        return ApiResponse.success(result);
    }

    @PostMapping("/statistics/generate/monthly")
    public ApiResponse<StatisticRecord> generateMonthlyStatistic() {
        StatisticRecord result = statisticService.generateMonthlyStatistic();
        return ApiResponse.success(result);
    }

    @PostMapping("/statistics/generate/quarterly")
    public ApiResponse<StatisticRecord> generateQuarterlyStatistic() {
        StatisticRecord result = statisticService.generateQuarterlyStatistic();
        return ApiResponse.success(result);
    }
}
