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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ccer_projects")
@CompoundIndex(name = "tenant_code_idx", def = "{'tenantId':1, 'projectCode':1}", unique = true)
public class CcerProject extends BaseEntity {

    public enum Status { DRAFT, SUBMITTED, UNDER_REVIEW, RECORDED, VALIDATION_PASSED, IMPLEMENTING, VERIFICATION_SUBMITTED, ISSUED, REJECTED, SUSPENDED }

    public enum Type {
        AFFORESTATION_REFORESTATION,
        GRID_CONNECTED_CSP,
        OFFSHORE_WIND,
        METHANE_RECOVERY_UTILIZATION,
        SOLAR_PV_GRID_CONNECTED,
        HYDRO_POWER,
        BIOMASS_POWER,
        GEOTHERMAL,
        ENERGY_EFFICIENCY,
        WASTE_HEAT_RECOVERY,
        INDUSTRIAL_EFFICIENCY,
        GREEN_BUILDING,
        MARINE_BIOMASS,
        BLUE_CARBON,
        OTHER
    }

    @Indexed
    private String projectCode;

    private String projectName;

    private Type projectType;

    private String methodologyCode;

    private String methodologyVersion;

    private String methodologyName;

    private String projectOwner;

    private String developer;

    private String location;

    private Double latitude;

    private Double longitude;

    private LocalDate startDate;

    private LocalDate creditingStartDate;

    private LocalDate creditingEndDate;

    private Integer creditingPeriodYears;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal expectedAnnualReduction;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal cumulativeIssued;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal cumulativeEstimated;

    private LocalDate recordDate;

    private String recordNo;

    private String validationBody;

    private String verificationBody;

    private String leadVerifierId;

    @Builder.Default
    private Status status = Status.DRAFT;

    @Builder.Default
    private List<Status> statusHistory = new ArrayList<>();

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();

    @Builder.Default
    private List<String> documentIds = new ArrayList<>();
}
