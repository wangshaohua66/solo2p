package com.gov.specialequipment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class DeviceRegisterDTO {

    @NotNull(message = "设备类型不能为空")
    private Integer deviceType;

    @NotBlank(message = "设备名称不能为空")
    private String deviceName;

    private String model;

    private String specification;

    @NotBlank(message = "制造单位不能为空")
    private String manufacturer;

    private String manufacturingLicense;

    private LocalDate manufactureDate;

    private String serialNumber;

    @NotNull(message = "使用单位不能为空")
    private Long useUnitId;

    @NotBlank(message = "安装地点不能为空")
    private String installationLocation;

    @NotBlank(message = "行政区划不能为空")
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

    private String maintenanceUnit;

    private String maintenanceContact;

    private String maintenancePhone;

    private String remark;
}
