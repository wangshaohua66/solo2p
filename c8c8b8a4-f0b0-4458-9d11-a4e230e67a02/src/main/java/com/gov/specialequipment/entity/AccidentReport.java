package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("accident_report")
public class AccidentReport extends BaseEntity {

    private String accidentNo;

    private Long deviceId;

    private String deviceCode;

    private Integer deviceType;

    private Long useUnitId;

    private String useUnitName;

    private Integer accidentLevel;

    private LocalDateTime accidentTime;

    private String accidentLocation;

    private Integer casualties;

    private Integer injuries;

    private Double directLoss;

    private String accidentDescription;

    private String reporter;

    private String reporterPhone;

    private LocalDateTime reportTime;

    private String emergencyMeasures;

    private String handlingStatus;

    private String remark;
}
