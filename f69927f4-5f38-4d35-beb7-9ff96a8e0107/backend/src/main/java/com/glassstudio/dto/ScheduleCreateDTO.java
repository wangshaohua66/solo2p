package com.glassstudio.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleCreateDTO {

    @NotNull(message = "窑炉ID不能为空")
    private Long kilnId;

    @NotNull(message = "会员ID不能为空")
    private Long memberId;

    @NotNull(message = "曲线ID不能为空")
    private Long curveId;

    @NotBlank(message = "开始时间不能为空")
    private String startTime;

    @NotBlank(message = "结束时间不能为空")
    private String endTime;

    @Min(value = 1, message = "工件数量至少为1")
    private Integer workpieceCount;

    private String note;
}
