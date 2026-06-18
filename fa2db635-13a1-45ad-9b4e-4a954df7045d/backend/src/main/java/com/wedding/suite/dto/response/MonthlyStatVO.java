package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class MonthlyStatVO {
    private String month;
    private BigDecimal revenue;
    private BigDecimal cost;
    private BigDecimal profit;
    private long weddings;
}
