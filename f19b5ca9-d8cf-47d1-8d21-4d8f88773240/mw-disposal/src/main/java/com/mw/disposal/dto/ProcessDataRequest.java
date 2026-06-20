package com.mw.disposal.dto;

import com.mw.disposal.document.TimeValue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class ProcessDataRequest {

    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    @Valid
    @NotNull(message = "温度曲线不能为空")
    private List<TimeValue> temperatureCurve;

    @Valid
    private List<TimeValue> pressureCurve;

    private Integer sterilizationDurationMinutes;

    private Integer durationMinutes;
}
