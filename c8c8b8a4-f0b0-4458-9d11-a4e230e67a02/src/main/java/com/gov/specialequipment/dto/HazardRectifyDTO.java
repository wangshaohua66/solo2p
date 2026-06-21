package com.gov.specialequipment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class HazardRectifyDTO {

    @NotNull(message = "隐患ID不能为空")
    private Long hazardId;

    @NotBlank(message = "整改措施不能为空")
    private String rectificationMeasures;

    @NotNull(message = "整改日期不能为空")
    private LocalDate rectificationDate;

    private String rectifier;

    private String remark;
}
