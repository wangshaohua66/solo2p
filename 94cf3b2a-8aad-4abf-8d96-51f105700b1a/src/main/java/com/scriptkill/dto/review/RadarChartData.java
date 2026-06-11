package com.scriptkill.dto.review;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "雷达图数据响应")
public class RadarChartData {

    @Schema(description = "剧本评分")
    private Double scriptRating;

    @Schema(description = "DM专业度")
    private Double dmProfessionalism;

    @Schema(description = "角色契合度")
    private Double characterFit;

    @Schema(description = "整体体验")
    private Double overallExperience;

    @Schema(description = "剧情质量")
    private Double storyRating;

    @Schema(description = "氛围营造")
    private Double atmosphereRating;

    @Schema(description = "样本数量")
    private Long sampleCount;
}
