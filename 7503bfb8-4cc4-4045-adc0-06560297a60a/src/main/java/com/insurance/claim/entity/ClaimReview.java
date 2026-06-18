package com.insurance.claim.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class ClaimReview {

    private Long id;
    private Long claimId;
    private String claimNo;
    private Long reviewerId;
    private String reviewerName;
    private Integer reviewLevel;
    private String reviewType;
    private BigDecimal claimAmount;
    private BigDecimal reviewedAmount;
    private Integer reviewResult;
    private String reviewComments;
    private String rejectReason;
    private String supplementRequirements;
    private LocalDateTime reviewStartTime;
    private LocalDateTime reviewEndTime;
    private Integer reviewDuration;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
