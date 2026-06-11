package com.scriptkill.dto.matching;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "角色分配建议")
public class CharacterAssignment {

    @Schema(description = "玩家ID")
    private Long playerId;

    @Schema(description = "玩家昵称")
    private String playerName;

    @Schema(description = "角色ID")
    private Long characterId;

    @Schema(description = "角色名称")
    private String characterName;

    @Schema(description = "角色契合度")
    private Double fitScore;
}
