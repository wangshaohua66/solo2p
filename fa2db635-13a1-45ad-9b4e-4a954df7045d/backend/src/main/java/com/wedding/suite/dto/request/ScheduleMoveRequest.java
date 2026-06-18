package com.wedding.suite.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ScheduleMoveRequest {
    @NotBlank(message = "开始时间不能为空")
    private String start;

    @NotBlank(message = "结束时间不能为空")
    private String end;
}
