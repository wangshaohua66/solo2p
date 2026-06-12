package com.carbon.ccer.entity;

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
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ccer_issuances")
@CompoundIndex(name = "project_period_idx", def = "{'projectId':1, 'verificationId':1}", unique = true)
public class CcerIssuance extends BaseEntity {

    public enum Status { PENDING_APPROVAL, APPROVED, ISSUED, TRANSFERRED, RETIRED, CANCELLED }

    @Indexed
    private String projectId;

    private String projectCode;

    private String projectName;

    private String verificationId;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal verifiedReductionTco2e;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal bufferDeductionTco2e;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal issuedTons;

    private String serialNumberPrefix;

    private String serialNumberStart;

    private String serialNumberEnd;

    private Integer serialBlockSize;

    private LocalDate approveDate;

    private String approveNo;

    private String approveAgency;

    private Status status;

    private String retireNote;

    private String transferToTenantId;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal transferredTons;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal retiredTons;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal availableTons;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
