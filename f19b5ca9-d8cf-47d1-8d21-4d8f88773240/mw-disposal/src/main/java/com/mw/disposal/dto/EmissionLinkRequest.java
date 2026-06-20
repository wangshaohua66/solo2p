package com.mw.disposal.dto;

import com.mw.disposal.document.EmissionData;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class EmissionLinkRequest {

    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    @Valid
    @NotNull(message = "排放数据不能为空")
    private EmissionData emissionData;
}
