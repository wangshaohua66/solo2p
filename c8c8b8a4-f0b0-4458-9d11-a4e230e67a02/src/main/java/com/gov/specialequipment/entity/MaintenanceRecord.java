package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("maintenance_record")
public class MaintenanceRecord extends BaseEntity {

    private String maintenanceNo;

    private Long deviceId;

    private String deviceCode;

    private Integer deviceType;

    private Long useUnitId;

    private String useUnitName;

    private String maintenanceUnit;

    private String maintenancePerson;

    private String maintenancePhone;

    private LocalDate maintenanceDate;

    private String maintenanceType;

    private String maintenanceContent;

    private String problemsFound;

    private String handlingMeasures;

    private String nextMaintenanceDate;

    private String operator;

    private String remark;
}
