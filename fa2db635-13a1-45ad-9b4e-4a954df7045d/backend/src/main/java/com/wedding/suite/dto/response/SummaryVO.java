package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class SummaryVO {
    private BigDecimal revenue;
    private BigDecimal cost;
    private BigDecimal profit;
    private long weddings;
    private long signed;
    private long conflictAlerts;
    private BigDecimal overdueReceivable;
}
