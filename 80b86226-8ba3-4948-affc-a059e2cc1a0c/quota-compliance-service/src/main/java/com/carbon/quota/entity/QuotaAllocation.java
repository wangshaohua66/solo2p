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
import java.util.HashMap;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "quota_allocations")
@CompoundIndex(name = "tenant_year_org_idx", def = "{'tenantId':1, 'complianceYear':1, 'organizationId':1}", unique = true)
public class QuotaAllocation extends BaseEntity {

    private Integer complianceYear;

    private String organizationId;

    private String organizationName;

    private String sector;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal freeQuota;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal paidQuota;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal preAllocatedQuota;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal finalApprovedQuota;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal carryInQuota;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal carryOutQuota;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal maxCcerOffsetTons;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal usedCcerOffsetTons;

    private String allocationMethod;

    private LocalDate approvalDate;

    private String approvedBy;

    @Builder.Default
    private String status = "DRAFT";

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
