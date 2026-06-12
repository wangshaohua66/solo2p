package com.carbon.calc.entity;

import com.carbon.common.entity.BaseEntity;
import com.carbon.common.enums.AccountingStandard;
import com.carbon.common.enums.GreenhouseGas;
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
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "calculation_diffs")
@CompoundIndex(name = "tenant_task_standards_source_idx",
        def = "{'tenantId':1, 'taskId':1, 'standardA':1, 'standardB':1, 'sourceId':1}")
public class CalculationDiff extends BaseEntity {

    private String taskId;

    private String period;

    private AccountingStandard standardA;

    private AccountingStandard standardB;

    private String sourceId;

    private String sourceCode;

    private GreenhouseGas gas;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal co2eqA;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal co2eqB;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal deltaAbs;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal deltaPercent;

    private String rootCause;

    private String diffFormula;

    private Map<String, Object> diffDetails;
}
