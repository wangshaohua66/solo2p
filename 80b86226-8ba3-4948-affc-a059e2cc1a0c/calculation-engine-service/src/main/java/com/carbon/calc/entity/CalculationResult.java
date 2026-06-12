package com.carbon.calc.entity;

import com.carbon.common.entity.BaseEntity;
import com.carbon.common.enums.AccountingStandard;
import com.carbon.common.enums.GreenhouseGas;
import com.carbon.common.enums.ScopeType;
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
import java.util.HashMap;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "calculation_results")
@CompoundIndex(name = "tenant_task_standard_source_idx",
        def = "{'tenantId':1, 'taskId':1, 'standard':1, 'sourceId':1, 'gas':1}")
@CompoundIndex(name = "tenant_period_standard_idx",
        def = "{'tenantId':1, 'period':1, 'standard':1}")
public class CalculationResult extends BaseEntity {

    @Indexed
    private String taskId;

    private Integer periodYear;

    private Integer periodMonth;

    private String period;

    @Indexed
    private AccountingStandard standard;

    @Indexed
    private String sourceId;

    private String sourceCode;

    private String sourceName;

    private ScopeType scope;

    @Indexed
    private GreenhouseGas gas;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal activityValue;

    private String activityUnit;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal factorValue;

    private String factorUnit;

    private String factorLibrary;

    private String factorVersion;

    private String factorMatchKey;

    private String formula;

    private Map<String, Object> formulaParams;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal gasEmissionTons;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal co2eqTons;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal gwpUsed;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal oxidationRate;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal carbonContent;

    private String qualityTag;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
