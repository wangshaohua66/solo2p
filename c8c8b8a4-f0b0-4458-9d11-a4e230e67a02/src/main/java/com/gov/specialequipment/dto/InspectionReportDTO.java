package com.gov.specialequipment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class InspectionReportDTO {

    @NotBlank(message = "检验报告编号不能为空")
    private String inspectionNo;

    @NotNull(message = "设备ID不能为空")
    private Long deviceId;

    @NotNull(message = "检验结论不能为空")
    private Integer conclusion;

    @NotNull(message = "检验日期不能为空")
    private LocalDate inspectionDate;

    private LocalDate reportDate;

    private LocalDate nextInspectionDate;

    private String inspector;

    private String inspectorCertificate;

    private String defectDescription;

    private String rectificationRequirements;

    private String reportFileUrl;

    private String remark;
}
