package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("device")
public class Device extends BaseEntity {

    private String deviceCode;

    private Integer deviceType;

    private String deviceName;

    private String model;

    private String specification;

    private String manufacturer;

    private String manufacturingLicense;

    private LocalDate manufactureDate;

    private String serialNumber;

    private Long useUnitId;

    private String useUnitName;

    private String installationLocation;

    private String regionCode;

    private String regionName;

    private BigDecimal ratedSpeed;

    private BigDecimal ratedLoad;

    private BigDecimal span;

    private BigDecimal volume;

    private BigDecimal workingPressure;

    private BigDecimal ropewayLength;

    private LocalDate installDate;

    private LocalDate acceptanceDate;

    private LocalDate lastInspectionDate;

    private LocalDate nextInspectionDate;

    private Integer status;

    private String maintenanceUnit;

    private String maintenanceContact;

    private String maintenancePhone;

    private String remark;

    private LocalDateTime registerTime;
}
