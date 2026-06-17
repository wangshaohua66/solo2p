package com.heritage.restoration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ProgressUpdateDTO {
    @NotNull(message = "进度百分比不能为空")
    private Integer progress;

    @NotBlank(message = "操作描述不能为空")
    private String content;

    private String stage;
}
