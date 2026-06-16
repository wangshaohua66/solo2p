package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "调班请求")
public class SwapRequestDTO {

    @NotNull(message = "排班ID不能为空")
    @Schema(description = "排班记录ID")
    private Long rosterId;

    @NotNull(message = "调班原因不能为空")
    @Schema(description = "调班原因: SICK/EMERGENCY/PERSONAL", example = "SICK")
    private String reason;

    @Schema(description = "紧急程度: URGENT/NORMAL", example = "URGENT")
    private String urgency = "NORMAL";

    @Schema(description = "指定替代人员ID（可选）")
    private Long targetCrewId;
}
