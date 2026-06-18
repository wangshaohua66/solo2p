package com.wedding.suite.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class ContractDraftRequest {
    @NotNull(message = "婚礼ID不能为空")
    @Positive(message = "婚礼ID必须为正数")
    private Long weddingId;

    @NotNull(message = "套餐ID不能为空")
    @Positive(message = "套餐ID必须为正数")
    private Long packageId;
}
