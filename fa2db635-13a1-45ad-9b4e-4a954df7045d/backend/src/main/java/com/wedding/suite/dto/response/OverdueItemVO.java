package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class OverdueItemVO {
    private Long id;
    private String type;
    private String party;
    private BigDecimal amount;
    private int days;
    private Long weddingId;
}
