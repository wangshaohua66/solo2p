package com.scriptkill.dto.script;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "阶段响应")
public class StageResponse {

    @Schema(description = "阶段ID")
    private Long id;

    @Schema(description = "阶段序号")
    private Integer stageOrder;

    @Schema(description = "阶段名称")
    private String name;

    @Schema(description = "阶段描述")
    private String description;

    @Schema(description = "阶段时长（分钟）")
    private Integer durationMinutes;

    @Schema(description = "阶段目标")
    private String stageGoal;

    @Schema(description = "可见性级别")
    private String visibilityLevel;

    @Schema(description = "DM提示（DM可见）")
    private String dmHint;

    @Schema(description = "事件触发器")
    private String eventTrigger;
}
