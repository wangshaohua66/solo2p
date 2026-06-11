package com.scriptkill.dto.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Schema(description = "DM排班响应")
public class DMScheduleResponse {

    @Schema(description = "排班ID")
    private Long id;

    @Schema(description = "DM用户ID")
    private Long dmId;

    @Schema(description = "DM昵称")
    private String dmName;

    @Schema(description = "会话ID")
    private Long sessionId;

    @Schema(description = "剧本名称")
    private String scriptName;

    @Schema(description = "排班日期")
    private LocalDate scheduleDate;

    @Schema(description = "开始时间")
    private LocalTime startTime;

    @Schema(description = "结束时间")
    private LocalTime endTime;

    @Schema(description = "班次类型: MORNING, AFTERNOON, EVENING, NIGHT")
    private String shiftType;

    @Schema(description = "提成金额")
    private Integer commissionAmount;

    @Schema(description = "难度系数")
    private Double difficultyCoefficient;

    @Schema(description = "玩家数")
    private Integer playerCount;

    @Schema(description = "基础工资")
    private Integer baseSalary;

    @Schema(description = "奖金")
    private Integer bonus;

    @Schema(description = "总收益")
    private Integer totalEarnings;

    @Schema(description = "是否已结算")
    private Boolean isPaid;

    @Schema(description = "状态: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED")
    private String status;

    @Schema(description = "备注")
    private String notes;
}
