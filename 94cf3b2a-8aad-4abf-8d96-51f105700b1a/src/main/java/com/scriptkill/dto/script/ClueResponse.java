package com.scriptkill.dto.script;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "线索响应")
public class ClueResponse {

    @Schema(description = "线索ID")
    private Long id;

    @Schema(description = "线索标题")
    private String title;

    @Schema(description = "线索内容")
    private String content;

    @Schema(description = "线索等级")
    private Integer clueLevel;

    @Schema(description = "触发类型: TIME, LOCATION, EVENT")
    private String triggerType;

    @Schema(description = "触发条件")
    private String triggerCondition;

    @Schema(description = "触发时间（分钟）")
    private Integer triggerTimeMinutes;

    @Schema(description = "触发位置")
    private String triggerLocation;

    @Schema(description = "是否关键线索")
    private Boolean isKeyClue;

    @Schema(description = "排序")
    private Integer sortOrder;

    @Schema(description = "图片URL")
    private String imageUrl;

    @Schema(description = "DM备注")
    private String dmNote;

    @Schema(description = "阶段ID")
    private Long stageId;

    @Schema(description = "角色ID")
    private Long characterId;
}
