package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class QuoteItemVO {
    private String name;
    private BigDecimal cost;
    private BigDecimal price;
    private int qty;
}
