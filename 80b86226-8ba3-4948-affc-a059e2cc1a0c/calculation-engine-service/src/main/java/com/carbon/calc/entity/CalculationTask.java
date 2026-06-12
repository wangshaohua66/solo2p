package com.carbon.calc.entity;

import com.carbon.common.entity.BaseEntity;
import com.carbon.common.enums.AccountingStandard;
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
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "calculation_tasks")
@CompoundIndex(name = "tenant_period_status_idx",
        def = "{'tenantId':1, 'periodYear':1, 'periodMonth':1, 'status':1}")
public class CalculationTask extends BaseEntity {

    @Indexed
    private String taskName;

    private Integer periodYear;

    private Integer periodMonth;

    private String period;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    @Builder.Default
    private List<AccountingStandard> standards = List.of(
            AccountingStandard.ISO_14064_1,
            AccountingStandard.GHG_PROTOCOL,
            AccountingStandard.CBAM
    );

    private List<String> scopeFilter;

    private List<String> sourceIds;

    @Builder.Default
    private String status = "PENDING";

    private String errorMessage;

    private String triggeredBy;

    @Field(targetType = FieldType.DOUBLE)
    private Double totalDurationMs;

    private Instant startedAt;

    private Instant completedAt;

    private Long sourcesCount;

    private Long recordsCount;

    private Long missingFactors;

    @Builder.Default
    private Map<String, Object> metrics = new HashMap<>();

    @Builder.Default
    private List<String> evidenceIds = new java.util.ArrayList<>();

    @Transient
    public boolean isPeriodFullMonth() {
        return periodStart != null && periodStart.getDayOfMonth() == 1
                && periodEnd != null && periodEnd.equals(periodEnd.plusMonths(1).withDayOfMonth(1).minusDays(1));
    }
}
