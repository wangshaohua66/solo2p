package com.emergency.incident.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "灾情归档请求")
public class ArchiveIncidentRequest {

    @Schema(description = "灾情ID", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "灾情ID不能为空")
    private Long incidentId;

    @Schema(description = "归档类型", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "归档类型不能为空")
    private String archiveType;

    @Schema(description = "归档备注")
    private String archiveRemark;
}
