package com.wedding.suite.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class AddonQtyRequest {
    @NotNull(message = "附加项ID不能为空")
    @Positive(message = "附加项ID必须为正数")
    private Long addonId;

    @NotNull(message = "数量不能为空")
    @Min(value = 1, message = "数量至少为1")
    private Integer qty;
}
