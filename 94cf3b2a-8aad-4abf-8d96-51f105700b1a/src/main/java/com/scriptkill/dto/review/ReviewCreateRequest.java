package com.scriptkill.dto.review;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "创建复盘评分请求")
public class ReviewCreateRequest {

    @Schema(description = "会话ID", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "会话ID不能为空")
    private Long sessionId;

    @Schema(description = "剧本评分（1-10分）", example = "8", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "剧本评分不能为空")
    @Min(value = 1, message = "评分最低为1分")
    @Max(value = 10, message = "评分最高为10分")
    private Integer scriptRating;

    @Schema(description = "DM专业度评分（1-10分）", example = "9", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "DM专业度评分不能为空")
    @Min(value = 1, message = "评分最低为1分")
    @Max(value = 10, message = "评分最高为10分")
    private Integer dmProfessionalism;

    @Schema(description = "角色契合度评分（1-10分）", example = "7", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "角色契合度评分不能为空")
    @Min(value = 1, message = "评分最低为1分")
    @Max(value = 10, message = "评分最高为10分")
    private Integer characterFit;

    @Schema(description = "整体体验评分（1-10分）", example = "8", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "整体体验评分不能为空")
    @Min(value = 1, message = "评分最低为1分")
    @Max(value = 10, message = "评分最高为10分")
    private Integer overallExperience;

    @Schema(description = "剧情评分（1-10分）", example = "8")
    private Integer storyRating;

    @Schema(description = "难度评分（1-10分）", example = "6")
    private Integer puzzleDifficultyRating;

    @Schema(description = "氛围评分（1-10分）", example = "9")
    private Integer atmosphereRating;

    @Schema(description = "是否匿名", example = "true")
    private Boolean isAnonymous = true;

    @Schema(description = "评价内容")
    private String comment;

    @Schema(description = "建议")
    private String suggestions;

    @Schema(description = "是否推荐", example = "true")
    private Boolean wouldRecommend;

    @Schema(description = "情感标签，逗号分隔")
    private String emotionalTags;
}
