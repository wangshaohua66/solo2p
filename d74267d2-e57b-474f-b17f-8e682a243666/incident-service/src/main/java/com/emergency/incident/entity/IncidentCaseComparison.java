package com.emergency.incident.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("incident_case_comparison")
public class IncidentCaseComparison extends BaseEntity {

    private String comparisonNo;

    private Long sourceIncidentId;

    private Long targetCaseId;

    private BigDecimal similarity;

    private String comparisonMetrics;

    private String differences;

    private String similarities;

    private String suggestions;

    private String comparisonResult;

    private Integer status;
}
