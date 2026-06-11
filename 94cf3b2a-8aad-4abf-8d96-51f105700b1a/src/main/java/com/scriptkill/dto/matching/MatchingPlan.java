package com.scriptkill.dto.matching;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "拼场匹配方案")
public class MatchingPlan {

    @Schema(description = "方案排名")
    private Integer rank;

    @Schema(description = "综合匹配得分")
    private Double totalScore;

    @Schema(description = "玩家ID列表")
    private List<Long> playerIds;

    @Schema(description = "玩家昵称列表")
    private List<String> playerNames;

    @Schema(description = "匹配得分详情")
    private MatchingScoreDetail scoreDetail;

    @Schema(description = "角色分配建议")
    private List<CharacterAssignment> characterAssignments;
}
