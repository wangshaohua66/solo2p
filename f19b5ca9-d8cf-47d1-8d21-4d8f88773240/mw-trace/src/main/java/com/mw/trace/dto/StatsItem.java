package com.mw.trace.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class StatsItem {

    private String groupKey;

    private Double producedKg = 0.0;

    private Double transferredKg = 0.0;

    private Double disposedKg = 0.0;

    private Long producedCount = 0L;
}
