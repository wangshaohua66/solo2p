package com.insurance.claim.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class LossAssessment {

    private Long id;
    private Long claimId;
    private String claimNo;
    private Long assessorId;
    private String assessorName;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Integer liabilityRatio;
    private BigDecimal totalPartsCost;
    private BigDecimal totalLaborCost;
    private BigDecimal totalMaterialCost;
    private BigDecimal totalOtherCost;
    private BigDecimal totalLossAmount;
    private BigDecimal salvageValue;
    private BigDecimal netLossAmount;
    private Boolean exceedStandard;
    private Boolean approvalRequired;
    private String approvalStatus;
    private Long approverId;
    private String approverComments;
    private String assessmentComments;
    private Integer version;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private transient List<LossItem> lossItems;
}
