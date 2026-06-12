package com.carbon.factor.entity;

import com.carbon.common.entity.BaseEntity;
import com.carbon.common.enums.FactorLibrary;
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

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "factor_change_logs")
@CompoundIndex(name = "lib_matchkey_time_idx", def = "{'library':1, 'matchKey':1, 'createdAt':-1}")
public class FactorChangeLog extends BaseEntity {

    private FactorLibrary library;

    private String versionFrom;

    private String versionTo;

    private String matchKey;

    private String factorCode;

    private GreenhouseGas gas;

    private String changeType;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal oldValue;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal newValue;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal delta;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal deltaPercent;

    private String oldUnit;

    private String newUnit;

    private String reason;

    private String impactAssessment;
}
