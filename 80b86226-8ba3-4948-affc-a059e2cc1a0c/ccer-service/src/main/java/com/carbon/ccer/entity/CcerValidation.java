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
@Document(collection = "ccer_validations")
@CompoundIndex(name = "project_idx", def = "{'projectId':1}")
public class CcerValidation extends BaseEntity {

    private String projectId;

    private String validationBody;

    private String leadValidator;

    private String validatorLicense;

    private LocalDate onSiteStartDate;

    private LocalDate onSiteEndDate;

    private List<String> stakeholderComments;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal assessedBaselineTco2e;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal assessedProjectEmissionTco2e;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal assessedLeakageTco2e;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal assessedAnnualReduction;

    private String assessmentSummary;

    @Builder.Default
    private List<String> majorCorrectives = new ArrayList<>();

    @Builder.Default
    private List<String> minorCorrectives = new ArrayList<>();

    private Boolean nonConformitiesClosed;

    private String conclusion; // PASS / FAIL / CONDITIONAL

    private LocalDate reportDate;

    private String reportDocId;

    private String validationStatement;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
