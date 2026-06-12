package com.carbon.ccer.entity;

import com.carbon.common.entity.BaseEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ccer_verifications")
@CompoundIndex(name = "project_period_idx", def = "{'projectId':1, 'periodStart':1, 'periodEnd':1}", unique = true)
public class CcerVerification extends BaseEntity {

    public enum Status { SUBMITTED, ON_SITE, ISSUES_RAISED, CORRECTED, VERIFIED, REJECTED }

    private String projectId;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    private String monitoringPeriodLabel;

    private String verificationBody;

    private String leadVerifier;

    private String verifierLicense;

    private LocalDate onSiteStartDate;

    private LocalDate onSiteEndDate;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal reportedReduction;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal verifiedReduction;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal verifiedBaseline;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal verifiedProjectEmission;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal verifiedLeakage;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal materialityThreshold;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal totalUncertainty;

    @Builder.Default
    private List<String> majorNonConformities = new ArrayList<>();

    @Builder.Default
    private List<String> minorNonConformities = new ArrayList<>();

    @Builder.Default
    private List<String> observations = new ArrayList<>();

    private Boolean conformitiesClosed;

    private String opinionStatement; // UNQUALIFIED / QUALIFIED / ADVERSE / DISCLAIMER

    private Status status;

    private LocalDate reportDate;

    private String reportDocId;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
