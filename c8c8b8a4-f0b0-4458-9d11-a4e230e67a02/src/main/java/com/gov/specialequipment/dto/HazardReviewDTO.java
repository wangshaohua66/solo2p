package com.gov.specialequipment.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class HazardReviewDTO {

    @NotNull(message = "隐患ID不能为空")
    private Long hazardId;

    @NotNull(message = "复查日期不能为空")
    private LocalDate reviewDate;

    private String reviewer;

    private Boolean passed;

    private String remark;
}
