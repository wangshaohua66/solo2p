package com.carbon.quota.entity;

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
import java.util.HashMap;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ccer_transfers")
@CompoundIndex(name = "tenant_year_ledger_idx", def = "{'tenantId':1, 'complianceYear':1, 'ledgerId':1}")
@CompoundIndex(name = "tenant_project_idx", def = "{'tenantId':1, 'projectId':1, 'projectCode':1}")
public class CcerTransfer extends BaseEntity {

    private Integer complianceYear;

    private String ledgerId;

    private String ccerIssuanceId;

    private String projectId;

    private String projectCode;

    private String projectName;

    private String methodology;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal transferTons;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal pricePerTon;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal totalValue;

    private LocalDate transferDate;

    private String serialNumberStart;

    private String serialNumberEnd;

    @Builder.Default
    private String status = "PENDING";

    private String approvalNote;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
