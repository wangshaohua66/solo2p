package com.mw.trace.dto;

import lombok.Data;

import java.util.List;

@Data
public class StatisticsResponse {

    private List<StatsItem> items;

    private Double totalProducedKg = 0.0;

    private Double totalTransferredKg = 0.0;

    private Double totalDisposedKg = 0.0;

    private Double prevTotalProducedKg = 0.0;

    private Double prevTotalTransferredKg = 0.0;

    private Double prevTotalDisposedKg = 0.0;

    /** 产生量同比/环比变化百分比 */
    private Double producedChangePct;

    private Double transferredChangePct;

    private Double disposedChangePct;
}
