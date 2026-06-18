package com.iccert.task.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("lab_equipment")
public class LabEquipment extends BaseEntity {
    private String equipmentCode;
    private String equipmentName;
    private String equipmentModel;
    private Long labId;
    private String labName;
    private String equipmentStatus;
    private Integer currentLoad;
    private Integer maxLoad;
    private java.time.LocalDate lastCalibrationDate;
    private java.time.LocalDate nextCalibrationDate;
    private Integer calibrationCycleDays;
    private String manufacturer;
    private java.time.LocalDate purchaseDate;
    private String remark;
}
