package com.scriptkill.dto.risk;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "玩家风控信息")
public class PlayerRiskInfo {

    @Schema(description = "玩家ID")
    private Long playerId;

    @Schema(description = "玩家昵称")
    private String playerName;

    @Schema(description = "信用分（0-100）")
    private Integer creditScore;

    @Schema(description = "爽约次数")
    private Integer noShowCount;

    @Schema(description = "总预约次数")
    private Integer totalBookingCount;

    @Schema(description = "爽约率")
    private Double noShowRate;

    @Schema(description = "风险等级: LOW, MEDIUM, HIGH, CRITICAL")
    private String riskLevel;

    @Schema(description = "建议定金倍数")
    private Double depositMultiplier;

    @Schema(description = "是否需要预付定金")
    private Boolean requireDeposit;

    @Schema(description = "建议备注")
    private String suggestion;
}
