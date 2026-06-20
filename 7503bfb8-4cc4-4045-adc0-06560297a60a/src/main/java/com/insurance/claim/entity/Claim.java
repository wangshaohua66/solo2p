package com.insurance.claim.entity;

import com.insurance.claim.enums.ClaimStatus;
import com.insurance.claim.enums.InsuranceType;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class Claim {

    private Long id;
    private String claimNo;
    private String policyNo;
    private InsuranceType insuranceType;
    private ClaimStatus status;
    private LocalDateTime accidentTime;
    private String accidentLocation;
    private String accidentProvince;
    private String accidentCity;
    private String accidentDistrict;
    private BigDecimal accidentLongitude;
    private BigDecimal accidentLatitude;
    private String accidentDescription;
    private String reporterName;
    private String reporterPhone;
    private String reporterIdCard;
    private BigDecimal estimatedAmount;
    private BigDecimal totalLossAmount;
    private BigDecimal deductibleAmount;
    private BigDecimal payableAmount;
    private BigDecimal paidAmount;
    private Integer liabilityRatio;
    private Integer accidentCount;
    private BigDecimal floatingCoefficient;
    private Long surveyorId;
    private String surveyorName;
    private Long assessorId;
    private String assessorName;
    private Long reviewerId;
    private String reviewerName;
    private Long financeId;
    private String financeName;
    private Integer caseLevel;
    private String caseLevelName;
    private Boolean fastTrack;
    private Boolean autoReviewed;
    private Integer fraudScore;
    private String fraudFlags;
    private Boolean fraudSuspicious;
    private String reviewComments;
    private String rejectReason;
    private LocalDateTime reportedAt;
    private LocalDateTime surveyAssignedAt;
    private LocalDateTime surveyCompletedAt;
    private LocalDateTime assessmentCompletedAt;
    private LocalDateTime reviewCompletedAt;
    private LocalDateTime calculationCompletedAt;
    private LocalDateTime paymentCompletedAt;
    private LocalDateTime closedAt;
    private String remark;
    private Integer version;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private transient List<ClaimParty> parties;
    private transient List<ClaimDocument> documents;
    private transient Survey survey;
    private transient LossAssessment assessment;
    private transient List<ClaimReview> reviews;
    private transient List<Payment> payments;
    private transient Policy policy;
}
