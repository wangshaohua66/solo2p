package com.tvstation.media.service;

import com.tvstation.media.dto.WorkloadStatDTO;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface StatisticsService {

    List<WorkloadStatDTO> getWorkloadStatistics(LocalDate startDate, LocalDate endDate,
                                               String groupBy, String department, Long userId);

    Map<String, Object> getProductionStatistics(LocalDate startDate, LocalDate endDate);

    Map<String, Object> getEfficiencyStatistics(LocalDate startDate, LocalDate endDate);
}
