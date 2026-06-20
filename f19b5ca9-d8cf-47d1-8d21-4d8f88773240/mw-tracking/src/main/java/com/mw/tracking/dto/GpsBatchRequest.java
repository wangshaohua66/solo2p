package com.mw.tracking.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class GpsBatchRequest {

    @NotEmpty(message = "GPS数据不能为空")
    @Size(max = 2000, message = "单批GPS数据不超过2000条")
    @Valid
    private List<GpsIngestDTO> points;
}
