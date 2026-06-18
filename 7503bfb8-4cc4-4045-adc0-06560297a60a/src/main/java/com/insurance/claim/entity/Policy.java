package com.insurance.claim.entity;

import com.insurance.claim.enums.InsuranceType;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class Policy {

    private Long id;
    private String policyNo;
    private InsuranceType insuranceType;
    private String productCode;
    private String productName;
    private String policyholderName;
    private String policyholderIdCard;
    private String policyholderPhone;
    private String insuredName;
    private String insuredIdCard;
    private String insuredPhone;
    private BigDecimal totalPremium;
    private BigDecimal totalCoverage;
    private BigDecimal deductible;
    private BigDecimal deductibleRatio;
    private LocalDate effectiveDate;
    private LocalDate expiryDate;
    private String vehiclePlateNo;
    private String vehicleFrameNo;
    private String vehicleEngineNo;
    private String vehicleBrand;
    private String vehicleModel;
    private Integer vehicleRegisterYear;
    private String propertyAddress;
    private BigDecimal propertyValue;
    private String enterpriseName;
    private String enterpriseAddress;
    private Integer policyStatus;
    private String branchCode;
    private String branchName;
    private String agentCode;
    private String agentName;
    private Integer claimCount;
    private BigDecimal totalClaimAmount;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
