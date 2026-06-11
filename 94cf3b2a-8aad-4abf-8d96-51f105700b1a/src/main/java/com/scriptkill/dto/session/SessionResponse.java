package com.scriptkill.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "开本会话响应")
public class SessionResponse {

    @Schema(description = "会话ID")
    private Long id;

    @Schema(description = "剧本ID")
    private Long scriptId;

    @Schema(description = "剧本名称")
    private String scriptName;

    @Schema(description = "DM用户ID")
    private Long dmId;

    @Schema(description = "DM昵称")
    private String dmName;

    @Schema(description = "会话状态: NOT_STARTED, MATCHING, CONFIRMED, PLAYING, REVIEWING, COMPLETED, CANCELLED")
    private String status;

    @Schema(description = "开始时间")
    private LocalDateTime startTime;

    @Schema(description = "结束时间")
    private LocalDateTime endTime;

    @Schema(description = "当前阶段ID")
    private Long currentStageId;

    @Schema(description = "当前阶段索引")
    private Integer currentStageIndex;

    @Schema(description = "房间号")
    private String roomNumber;

    @Schema(description = "最大玩家数")
    private Integer maxPlayers;

    @Schema(description = "当前玩家数")
    private Integer currentPlayersCount;

    @Schema(description = "难度系数")
    private Double difficultyFactor;

    @Schema(description = "定金金额")
    private Integer depositAmount;

    @Schema(description = "单人价格")
    private Integer pricePerPerson;

    @Schema(description = "总收入")
    private Integer totalRevenue;

    @Schema(description = "DM提成")
    private Integer dmCommission;

    @Schema(description = "备注")
    private String notes;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
