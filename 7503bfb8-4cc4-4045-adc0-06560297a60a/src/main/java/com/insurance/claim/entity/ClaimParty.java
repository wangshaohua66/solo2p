package com.insurance.claim.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class ClaimParty {

    private Long id;
    private Long claimId;
    private String claimNo;
    private Integer partyType;
    private String partyName;
    private String partyIdCard;
    private String partyPhone;
    private String partyAddress;
    private String driverLicenseNo;
    private String driverLicenseType;
    private String vehiclePlateNo;
    private String vehicleType;
    private String vehicleUsage;
    private String insuranceCompany;
    private String policyNo;
    private BigDecimal insuranceAmount;
    private Integer liabilityRatio;
    private String injuryDescription;
    private String propertyDamageDescription;
    private String remark;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
