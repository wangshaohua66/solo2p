package com.scriptkill.dto.script;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Schema(description = "剧本详情响应")
public class ScriptDetailResponse {

    @Schema(description = "剧本ID")
    private Long id;

    @Schema(description = "剧本名称")
    private String name;

    @Schema(description = "剧本描述")
    private String description;

    @Schema(description = "最少玩家数")
    private Integer minPlayers;

    @Schema(description = "最多玩家数")
    private Integer maxPlayers;

    @Schema(description = "预计时长（分钟）")
    private Integer estimatedDurationMinutes;

    @Schema(description = "类型")
    private String genre;

    @Schema(description = "难度")
    private String difficulty;

    @Schema(description = "可见性级别")
    private String visibilityLevel;

    @Schema(description = "版本号")
    private Integer version;

    @Schema(description = "背景故事")
    private String backgroundStory;

    @Schema(description = "结局数量")
    private Integer endingCount;

    @Schema(description = "状态")
    private String status;

    @Schema(description = "总游玩次数")
    private Integer totalPlayedCount;

    @Schema(description = "平均评分")
    private Double averageRating;

    @Schema(description = "封面图片URL")
    private String coverImageUrl;

    @Schema(description = "角色列表")
    private List<CharacterResponse> characters;

    @Schema(description = "阶段列表")
    private List<StageResponse> stages;

    @Schema(description = "线索列表（DM可见）")
    private List<ClueResponse> clues;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
