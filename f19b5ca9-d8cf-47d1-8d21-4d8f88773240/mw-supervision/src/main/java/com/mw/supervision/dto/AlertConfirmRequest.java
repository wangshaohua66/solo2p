package com.mw.supervision.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AlertConfirmRequest {

    @NotBlank(message = "预警ID不能为空")
    private String alertId;

    private String feedback;
}
