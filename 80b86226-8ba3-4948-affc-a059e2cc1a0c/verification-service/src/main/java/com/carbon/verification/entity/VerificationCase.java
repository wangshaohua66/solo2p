package com.carbon.verification.entity;

import com.carbon.common.entity.BaseEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.Instant;
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
@Document(collection = "verification_cases")
@CompoundIndex(name = "tenant_year_status_idx",
        def = "{'tenantId':1, 'periodYear':1, 'status':1}")
public class VerificationCase extends BaseEntity {

    public enum Status { DRAFT, IN_PROGRESS, SUBMITTED, VERIFIER_REVIEW, ISSUES_RAISED, APPROVED, REJECTED, CLOSED }

    private String caseNumber;

    private Integer periodYear;

    private String scope;

    private String methodology;

    private String verificationBody;

    private String leadVerifier;

    private List<String> teamVerifiers;

    @Builder.Default
    private Status status = Status.DRAFT;

    @Builder.Default
    private List<Status> statusHistory = new ArrayList<>();

    private LocalDate plannedStartDate;

    private LocalDate plannedEndDate;

    private LocalDate actualStartDate;

    private LocalDate actualEndDate;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal declaredScope1;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal declaredScope2;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal declaredScope3;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal verifiedScope1;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal verifiedScope2;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal verifiedScope3;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal materialityThreshold;

    @Builder.Default
    private List<String> packages = new ArrayList<>();

    @Builder.Default
    private List<Map<String, Object>> issues = new ArrayList<>();

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
