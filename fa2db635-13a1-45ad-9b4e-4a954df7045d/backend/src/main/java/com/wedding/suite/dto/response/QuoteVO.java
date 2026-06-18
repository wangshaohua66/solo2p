package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@AllArgsConstructor
public class QuoteVO {
    private List<QuoteItemVO> items;
    private BigDecimal cost;
    private BigDecimal price;
    private BigDecimal discount;
    private BigDecimal total;
    private BigDecimal profit;
    private BigDecimal margin;
}
