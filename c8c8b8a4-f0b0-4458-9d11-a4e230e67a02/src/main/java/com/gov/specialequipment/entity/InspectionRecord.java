package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("inspection_record")
public class InspectionRecord extends BaseEntity {

    private String inspectionNo;

    private Long deviceId;

    private String deviceCode;

    private Integer deviceType;

    private Long agencyId;

    private String agencyName;

    private String inspector;

    private String inspectorCertificate;

    private LocalDate inspectionDate;

    private LocalDate reportDate;

    private Integer conclusion;

    private LocalDate nextInspectionDate;

    private String defectDescription;

    private String rectificationRequirements;

    private String reportFileUrl;

    private Integer status;

    private LocalDateTime receiveTime;

    private String remark;
}
