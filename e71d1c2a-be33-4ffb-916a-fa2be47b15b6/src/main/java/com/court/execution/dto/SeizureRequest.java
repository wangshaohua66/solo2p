package com.court.execution.dto;

import com.court.execution.entity.SeizureType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "查封冻结请求")
public class SeizureRequest {

    @NotNull(message = "财产ID不能为空")
    @Schema(description = "财产ID", required = true)
    private Long propertyId;

    @NotNull(message = "查封类型不能为空")
    @Schema(description = "查封类型", required = true)
    private SeizureType seizureType;

    @NotBlank(message = "查封文号不能为空")
    @Schema(description = "查封文号", required = true)
    private String seizureDocumentNumber;

    @Schema(description = "协执单位ID")
    private Long coordinationUnitId;

    @NotNull(message = "查封开始时间不能为空")
    @Schema(description = "查封开始时间", required = true)
    private LocalDateTime startDate;

    @NotNull(message = "查封结束时间不能为空")
    @Schema(description = "查封结束时间", required = true)
    private LocalDateTime endDate;

    @Schema(description = "备注")
    private String remark;
}
