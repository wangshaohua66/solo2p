package com.wedding.suite.dto.request;

import com.wedding.suite.enums.ResourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class ScheduleCheckRequest {
    @NotNull(message = "资源类型不能为空")
    private ResourceType resourceType;

    @NotNull(message = "资源ID不能为空")
    @Positive(message = "资源ID必须为正数")
    private Long resourceId;

    @NotNull(message = "门店ID不能为空")
    @Positive(message = "门店ID必须为正数")
    private Long storeId;

    @NotBlank(message = "开始时间不能为空")
    private String start;

    @NotBlank(message = "结束时间不能为空")
    private String end;
}
