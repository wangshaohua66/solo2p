package com.scriptkill.dto.script;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
@Schema(description = "剧本创建请求")
public class ScriptCreateRequest {

    @Schema(description = "剧本名称", example = "雾都孤儿", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "剧本名称不能为空")
    private String name;

    @Schema(description = "剧本描述", example = "一个发生在维多利亚时代伦敦的悬疑推理故事")
    private String description;

    @Schema(description = "最少玩家数", example = "5", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "最少玩家数不能为空")
    @Positive(message = "最少玩家数必须大于0")
    private Integer minPlayers;

    @Schema(description = "最多玩家数", example = "8", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "最多玩家数不能为空")
    @Positive(message = "最多玩家数必须大于0")
    private Integer maxPlayers;

    @Schema(description = "预计时长（分钟）", example = "240", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "预计时长不能为空")
    @Positive(message = "预计时长必须大于0")
    private Integer estimatedDurationMinutes;

    @Schema(description = "类型: HORROR, EMOTIONAL, REASONING, SUSPENSE, HAPPY, SCI_FI, ANCIENT, MODERN",
            example = "REASONING", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "剧本类型不能为空")
    private String genre;

    @Schema(description = "难度: EASY, NORMAL, HARD, EXPERT", example = "NORMAL", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "难度不能为空")
    private String difficulty;

    @Schema(description = "可见性级别: PUBLIC, DM_ONLY, PLAYER_PARTIAL, SECRET", example = "PUBLIC")
    private String visibilityLevel;

    @Schema(description = "背景故事")
    private String backgroundStory;

    @Schema(description = "结局数量", example = "3")
    private Integer endingCount;

    @Schema(description = "封面图片URL")
    private String coverImageUrl;
}
