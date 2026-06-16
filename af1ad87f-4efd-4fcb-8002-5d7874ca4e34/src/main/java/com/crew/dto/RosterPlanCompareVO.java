package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "多排班方案对比结果")
public class RosterPlanCompareVO {

    @Schema(description = "方案数量")
    private int planCount;

    @Schema(description = "排名最高的方案ID（推荐）")
    private Long recommendedPlanId;

    @Schema(description = "方案列表（按综合评分降序排列）")
    private List<RosterPlanVO> plans;
}
