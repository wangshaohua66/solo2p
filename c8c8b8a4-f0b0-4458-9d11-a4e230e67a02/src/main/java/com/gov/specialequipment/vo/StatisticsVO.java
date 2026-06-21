package com.gov.specialequipment.vo;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class StatisticsVO {

    private Long totalDevices;

    private Long normalDevices;

    private Long overdueDevices;

    private Long stoppedDevices;

    private List<Map<String, Object>> deviceTypeDistribution;

    private List<Map<String, Object>> deviceStatusDistribution;

    private List<Map<String, Object>> deviceRegionDistribution;

    private Double inspectionRate;

    private List<Map<String, Object>> inspectionConclusionDistribution;

    private List<Map<String, Object>> inspectionMonthlyTrend;

    private Long totalHazards;

    private Long pendingHazards;

    private Long overdueHazards;

    private Long closedHazards;

    private List<Map<String, Object>> hazardLevelDistribution;

    private List<Map<String, Object>> hazardStatusDistribution;

    private List<Map<String, Object>> hazardMonthlyTrend;
}
