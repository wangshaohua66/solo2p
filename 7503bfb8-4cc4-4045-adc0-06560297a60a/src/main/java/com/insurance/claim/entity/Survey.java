package com.insurance.claim.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class Survey {

    private Long id;
    private Long claimId;
    private String claimNo;
    private Long surveyorId;
    private String surveyorName;
    private String surveyorPhone;
    private LocalDateTime assignedAt;
    private LocalDateTime departedAt;
    private LocalDateTime arrivedAt;
    private BigDecimal departLongitude;
    private BigDecimal departLatitude;
    private BigDecimal arriveLongitude;
    private BigDecimal arriveLatitude;
    private BigDecimal gpsDistance;
    private Boolean gpsVerified;
    private String weatherCondition;
    private String roadCondition;
    private String siteDescription;
    private String damageDescription;
    private String sceneDiagram;
    private Integer liabilityRatio;
    private String liabilityDetermination;
    private String policeReportNo;
    private String policeOpinion;
    private BigDecimal estimatedLossAmount;
    private String surveyComments;
    private LocalDateTime completedAt;
    private String remark;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private transient List<ClaimDocument> photos;
    private transient List<ClaimDocument> videos;
}
