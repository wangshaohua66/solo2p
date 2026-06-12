package com.carbon.quota.entity;

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
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "quota_ledgers")
@CompoundIndex(name = "tenant_year_month_org_idx",
        def = "{'tenantId':1, 'complianceYear':1, 'month':1, 'organizationId':1}")
public class QuotaLedger extends BaseEntity {

    private Integer complianceYear;

    @Indexed
    private Integer month;

    @Indexed
    private String period;

    private String organizationId;

    private String organizationName;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal openingBalance;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal allocatedIn;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal surrendered;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal ccerOffsetIn;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal ccerUsed;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal actualEmission;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal cumulativeEmission;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal cumulativeAllocated;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal expectedGap;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal closingBalance;

    private String calculationTaskId;

    private LocalDate reconciliationDate;

    @Builder.Default
    private String status = "INIT";

    @Builder.Default
    private List<String> evidenceIds = new ArrayList<>();

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
