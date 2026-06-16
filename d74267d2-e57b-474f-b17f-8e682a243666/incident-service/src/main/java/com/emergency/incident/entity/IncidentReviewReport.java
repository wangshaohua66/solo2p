package com.emergency.incident.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("incident_review_report")
public class IncidentReviewReport extends BaseEntity {

    private String reportNo;

    private Long incidentId;

    private Long archiveId;

    private String title;

    private String reportType;

    private String incidentSummary;

    private String responseProcess;

    private String timelinessAnalysis;

    private String resourceUtilization;

    private String existingProblems;

    private String improvementMeasures;

    private String lessonsLearned;

    private BigDecimal responseDuration;

    private Integer dispatchCount;

    private Integer teamCount;

    private Integer materialCount;

    private Integer casualtyCount;

    private Integer affectedCount;

    private BigDecimal lossEstimate;

    private BigDecimal efficiencyScore;

    private BigDecimal timelinessScore;

    private BigDecimal resourceScore;

    private BigDecimal overallScore;

    private Integer status;

    private Long generatedBy;

    private LocalDateTime generatedAt;

    private Long reviewedBy;

    private LocalDateTime reviewedAt;
}
