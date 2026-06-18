package com.insurance.claim.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class LossItem {

    private Long id;
    private Long assessmentId;
    private Long claimId;
    private Integer itemType;
    private String itemCategory;
    private String itemCode;
    private String itemName;
    private String itemDescription;
    private Integer quantity;
    private String unit;
    private BigDecimal guidePrice;
    private BigDecimal unitPrice;
    private BigDecimal totalAmount;
    private String priceRegion;
    private Boolean exceedGuidePrice;
    private BigDecimal exceedRatio;
    private String remark;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
