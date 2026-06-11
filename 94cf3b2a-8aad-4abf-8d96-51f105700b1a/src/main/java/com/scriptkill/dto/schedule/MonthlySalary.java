package com.scriptkill.dto.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "月度工资单")
public class MonthlySalary {

    @Schema(description = "DM用户ID")
    private Long dmId;

    @Schema(description = "DM昵称")
    private String dmName;

    @Schema(description = "年份")
    private Integer year;

    @Schema(description = "月份")
    private Integer month;

    @Schema(description = "排班级数")
    private Integer sessionCount;

    @Schema(description = "总玩家数")
    private Integer totalPlayers;

    @Schema(description = "基础工资合计")
    private Integer totalBaseSalary;

    @Schema(description = "提成合计")
    private Integer totalCommission;

    @Schema(description = "奖金合计")
    private Integer totalBonus;

    @Schema(description = "总工资")
    private Integer totalSalary;

    @Schema(description = "排班详情列表")
    private List<DMScheduleResponse> schedules;
}
