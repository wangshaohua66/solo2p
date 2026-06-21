package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("hazard_record")
public class HazardRecord extends BaseEntity {

    private String hazardNo;

    private Long deviceId;

    private String deviceCode;

    private Integer deviceType;

    private Long useUnitId;

    private String useUnitName;

    private Integer hazardLevel;

    private String hazardType;

    private String hazardDescription;

    private LocalDate discoveryDate;

    private String discoverer;

    private Long discovererId;

    private LocalDate deadline;

    private String rectificationRequirements;

    private String rectificationMeasures;

    private LocalDate rectificationDate;

    private String rectifier;

    private LocalDate reviewDate;

    private String reviewer;

    private Integer status;

    private Integer escalated;

    private LocalDateTime escalateTime;

    private String remark;
}
