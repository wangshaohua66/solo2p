package com.iccert.analytics.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("inspection_raw_record")
public class InspectionRawRecord extends BaseEntity {
    private Long taskId;
    private Long sampleId;
    private String sampleCode;
    private Long testItemId;
    private String testItemCode;
    private String testItemName;
    private String testMethod;
    private String standardCode;
    private LocalDateTime testStartTime;
    private LocalDateTime testEndTime;
    private BigDecimal testValue;
    private String testUnit;
    private BigDecimal standardMin;
    private BigDecimal standardMax;
    private String resultJudgment;
    private Long equipmentId;
    private String equipmentCode;
    private Long technicianId;
    private String technicianName;
    private String environmentParams;
    private String testDataJson;
    private String recordHash;
    private String prevRecordHash;
    private String recordContent;
    private Integer isTampered;
}
