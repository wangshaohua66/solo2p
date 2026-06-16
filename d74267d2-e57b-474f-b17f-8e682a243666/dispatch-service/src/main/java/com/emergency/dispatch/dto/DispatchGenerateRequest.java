package com.emergency.dispatch.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
@Schema(description = "调度方案生成请求")
public class DispatchGenerateRequest implements Serializable {

    @Schema(description = "灾情ID", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "灾情ID不能为空")
    private Long incidentId;

    @Schema(description = "灾情类型")
    private Integer incidentType;

    @Schema(description = "灾情等级")
    private Integer incidentLevel;

    @Schema(description = "指定的救援队伍ID列表")
    private List<Long> teamIds;

    @Schema(description = "是否跨区域调度")
    private Boolean crossRegion = false;

    @Schema(description = "最大调度半径(公里)")
    private Integer maxRadius = 100;

    @Schema(description = "需要的总人数")
    private Integer requiredPersonnel;

    @Schema(description = "任务描述")
    private String taskDescription;

    @Schema(description = "危险预警")
    private String dangerWarning;
}
