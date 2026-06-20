package com.insurance.claim.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class PartPriceGuide {

    private Long id;
    private String partCode;
    private String partName;
    private String partCategory;
    private String oemCode;
    private String vehicleBrand;
    private String vehicleModel;
    private Integer vehicleStartYear;
    private Integer vehicleEndYear;
    private String province;
    private String city;
    private String regionCode;
    private BigDecimal guidePrice;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private String priceLevel;
    private String supplierName;
    private String supplierLevel;
    private String brandType;
    private String qualityLevel;
    private String unit;
    private Integer status;
    private LocalDateTime effectiveDate;
    private LocalDateTime expiryDate;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
