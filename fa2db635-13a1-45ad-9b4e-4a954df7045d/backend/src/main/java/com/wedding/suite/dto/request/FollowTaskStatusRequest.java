package com.wedding.suite.dto.request;

import com.wedding.suite.enums.TaskStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FollowTaskStatusRequest {
    @NotNull(message = "任务状态不能为空")
    private TaskStatus status;
}
