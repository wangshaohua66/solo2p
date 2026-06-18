package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class WeddingVO {
    private Long id;
    private String coupleName;
    private String groomName;
    private String brideName;
    private String phone;
    private LocalDate weddingDate;
    private Integer guests;
    private String stage;
    private Long storeId;
    private String storeName;
    private Long plannerId;
    private String plannerName;
    private Long packageId;
    private String packageName;
    private BigDecimal quoteTotal;
    private Integer progress;
    private LocalDateTime createdAt;
}
