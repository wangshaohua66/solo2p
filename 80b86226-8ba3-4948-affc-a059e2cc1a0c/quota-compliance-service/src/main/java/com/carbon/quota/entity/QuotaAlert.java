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
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "quota_alerts")
@CompoundIndex(name = "tenant_level_status_idx", def = "{'tenantId':1, 'level':1, 'status':1, 'createdAt':-1}")
public class QuotaAlert extends BaseEntity {

    public enum Level { DEPARTMENT, ENTERPRISE, GROUP }

    @Indexed
    private String ledgerId;

    private Integer complianceYear;

    private Integer month;

    private String period;

    private String organizationId;

    private String organizationName;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal cumulativeAllocated;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal cumulativeEmission;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal expectedGap;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal gapPercent;

    @Indexed
    private Level level;

    @Builder.Default
    private String status = "OPEN";

    private String title;

    private String content;

    private List<String> notifierIds;

    private List<String> notifierMobiles;

    @Builder.Default
    private Map<String, Boolean> channelStatus = new HashMap<>();

    private Instant notifiedAt;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
