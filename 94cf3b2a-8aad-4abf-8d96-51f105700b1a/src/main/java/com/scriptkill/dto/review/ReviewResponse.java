package com.scriptkill.dto.review;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "复盘评分响应")
public class ReviewResponse {

    @Schema(description = "评分ID")
    private Long id;

    @Schema(description = "会话ID")
    private Long sessionId;

    @Schema(description = "剧本ID")
    private Long scriptId;

    @Schema(description = "玩家ID")
    private Long playerId;

    @Schema(description = "玩家昵称（匿名时显示为'匿名玩家'）")
    private String playerName;

    @Schema(description = "角色ID")
    private Long characterId;

    @Schema(description = "角色名称")
    private String characterName;

    @Schema(description = "剧本评分")
    private Integer scriptRating;

    @Schema(description = "DM专业度评分")
    private Integer dmProfessionalism;

    @Schema(description = "角色契合度评分")
    private Integer characterFit;

    @Schema(description = "整体体验评分")
    private Integer overallExperience;

    @Schema(description = "剧情评分")
    private Integer storyRating;

    @Schema(description = "难度评分")
    private Integer puzzleDifficultyRating;

    @Schema(description = "氛围评分")
    private Integer atmosphereRating;

    @Schema(description = "是否匿名")
    private Boolean isAnonymous;

    @Schema(description = "评价内容")
    private String comment;

    @Schema(description = "建议")
    private String suggestions;

    @Schema(description = "是否推荐")
    private Boolean wouldRecommend;

    @Schema(description = "情感标签")
    private String emotionalTags;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}
