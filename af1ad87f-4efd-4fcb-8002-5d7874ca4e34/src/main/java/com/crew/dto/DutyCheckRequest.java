package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "执勤打卡请求")
public class DutyCheckRequest {

    @NotNull(message = "机组人员ID不能为空")
    @Schema(description = "机组人员ID")
    private Long crewId;

    @NotNull(message = "排班ID不能为空")
    @Schema(description = "排班记录ID")
    private Long rosterId;

    @NotNull(message = "打卡类型不能为空")
    @Schema(description = "打卡类型: CHECK_IN/CHECK_OUT", example = "CHECK_IN")
    private String checkType;
}
