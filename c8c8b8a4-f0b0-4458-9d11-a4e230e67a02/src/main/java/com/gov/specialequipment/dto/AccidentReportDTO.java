package com.gov.specialequipment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AccidentReportDTO {

    private Long deviceId;

    @NotNull(message = "事故等级不能为空")
    private Integer accidentLevel;

    @NotNull(message = "事故时间不能为空")
    private LocalDateTime accidentTime;

    @NotBlank(message = "事故地点不能为空")
    private String accidentLocation;

    private Integer casualties;

    private Integer injuries;

    private Double directLoss;

    @NotBlank(message = "事故描述不能为空")
    private String accidentDescription;

    @NotBlank(message = "报告人不能为空")
    private String reporter;

    @NotBlank(message = "报告人电话不能为空")
    private String reporterPhone;

    private String emergencyMeasures;

    private String remark;
}
