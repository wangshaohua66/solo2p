package com.scriptkill.dto.matching;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "匹配得分详情")
public class MatchingScoreDetail {

    @Schema(description = "历史偏好得分")
    private Double historyPreferenceScore;

    @Schema(description = "年龄段匹配得分")
    private Double ageGroupScore;

    @Schema(description = "性别比例得分")
    private Double genderRatioScore;

    @Schema(description = "恐怖标签匹配得分")
    private Double horrorTagScore;

    @Schema(description = "情感标签匹配得分")
    private Double emotionalTagScore;

    @Schema(description = "推理能力匹配得分")
    private Double reasoningScore;

    @Schema(description = "社交匹配得分")
    private Double socialScore;
}
