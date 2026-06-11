package com.scriptkill.dto.booking;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "预约响应")
public class BookingResponse {

    @Schema(description = "预约ID")
    private Long id;

    @Schema(description = "会话ID")
    private Long sessionId;

    @Schema(description = "剧本名称")
    private String scriptName;

    @Schema(description = "玩家ID")
    private Long playerId;

    @Schema(description = "玩家昵称")
    private String playerName;

    @Schema(description = "分配角色ID")
    private Long assignedCharacterId;

    @Schema(description = "分配角色名称")
    private String assignedCharacterName;

    @Schema(description = "预约状态: PENDING, CONFIRMED, CANCELLED, NO_SHOW, COMPLETED")
    private String status;

    @Schema(description = "定金已付金额")
    private Integer depositPaid;

    @Schema(description = "全款已付金额")
    private Integer fullPricePaid;

    @Schema(description = "定金是否已退还")
    private Boolean isDepositRefunded;

    @Schema(description = "预约时间")
    private LocalDateTime bookingTime;

    @Schema(description = "取消时间")
    private LocalDateTime cancelTime;

    @Schema(description = "取消原因")
    private String cancelReason;

    @Schema(description = "备注")
    private String notes;

    @Schema(description = "签到时间")
    private LocalDateTime checkInTime;

    @Schema(description = "签退时间")
    private LocalDateTime checkOutTime;

    @Schema(description = "开始时间")
    private LocalDateTime startTime;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}
