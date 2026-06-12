package com.carbon.factor.entity;

import com.carbon.common.entity.BaseEntity;
import com.carbon.common.enums.ActivityDataType;
import com.carbon.common.enums.FactorLibrary;
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
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "emission_factors")
@CompoundIndex(name = "lib_matchkey_version_idx",
        def = "{'library':1, 'matchKey':1, 'versionCode':1}", unique = true)
@CompoundIndex(name = "lib_scope_type_idx",
        def = "{'library':1, 'scope':1, 'activityDataType':1}")
public class EmissionFactor extends BaseEntity {

    @Indexed
    private FactorLibrary library;

    @Indexed
    private String versionCode;

    private String factorName;

    private String factorCode;

    @Indexed
    private String matchKey;

    private ScopeType scope;

    private ActivityDataType activityDataType;

    private String fuelCode;

    private String fuelCategory;

    private String sector;

    private String subSector;

    private String technology;

    private String region;

    private GreenhouseGas gas;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal factorValue;

    private String factorUnit;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal uncertaintyLower;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal uncertaintyUpper;

    private String uncertaintyDistribution;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal gwpUsed;

    private String referenceSource;

    private String documentReference;

    private LocalDate effectiveFrom;

    private LocalDate effectiveTo;

    private String tier;

    private String methodology;

    private String formula;

    private String status;

    private Boolean tenantCustom;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
