package com.gov.specialequipment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class HazardCreateDTO {

    private Long deviceId;

    private Integer deviceType;

    @NotNull(message = "隐患等级不能为空")
    private Integer hazardLevel;

    @NotBlank(message = "隐患类型不能为空")
    private String hazardType;

    @NotBlank(message = "隐患描述不能为空")
    private String hazardDescription;

    @NotNull(message = "发现日期不能为空")
    private LocalDate discoveryDate;

    private LocalDate deadline;

    private String discoverer;

    private String rectificationRequirements;

    private String remark;
}
