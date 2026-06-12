package com.carbon.emission.entity;

import com.carbon.common.entity.BaseEntity;
import com.carbon.common.enums.ActivityDataType;
import com.carbon.common.enums.GreenhouseGas;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.math.BigDecimal;
import java.time.Instant;
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
@Document(collection = "activity_data")
@CompoundIndex(name = "tenant_source_period_idx", def = "{'tenantId': 1, 'sourceId': 1, 'periodYear': 1, 'periodMonth': 1}")
@CompoundIndex(name = "tenant_period_type_idx", def = "{'tenantId': 1, 'periodYear': 1, 'periodMonth': 1, 'activityDataType': 1}")
public class ActivityData extends BaseEntity {

    @Indexed
    private String sourceId;

    private String sourceCode;

    private String sourceName;

    private Integer periodYear;

    private Integer periodMonth;

    @Indexed
    private String period;

    @Indexed
    private ActivityDataType activityDataType;

    private GreenhouseGas overrideGas;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal rawValue;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal activityValue;

    private String inputUnit;

    private String outputUnit;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal netCalorificValue;

    private String ncvUnit;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal carbonContent;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal oxidationRate;

    @Builder.Default
    private Boolean interpolated = false;

    @Builder.Default
    private List<String> interpolationTrace = new ArrayList<>();

    @Builder.Default
    private Map<String, Object> rawAttributes = new HashMap<>();

    private String evidenceBundleId;

    @Builder.Default
    private List<String> evidenceIds = new ArrayList<>();

    @Builder.Default
    private String qualityStatus = "PENDING";

    private List<String> qualityIssues;

    private Instant importedAt;

    private String importBatchId;

    private String sourceSystem;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();

    @Transient
    public YearMonth getYearMonth() {
        if (periodYear == null || periodMonth == null) return null;
        return YearMonth.of(periodYear, periodMonth);
    }
}
