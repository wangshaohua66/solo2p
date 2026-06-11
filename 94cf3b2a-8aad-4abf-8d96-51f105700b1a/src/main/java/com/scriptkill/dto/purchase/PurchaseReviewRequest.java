package com.scriptkill.dto.purchase;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "本子评审请求")
public class PurchaseReviewRequest {

    @Schema(description = "采购评审ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "1")
    @NotNull(message = "评审ID不能为空")
    private Long purchaseId;

    @Schema(description = "评分（0-100分）", requiredMode = Schema.RequiredMode.REQUIRED, example = "75")
    @NotNull(message = "评分不能为空")
    @Min(value = 0, message = "评分最低为0分")
    @Max(value = 100, message = "评分最高为100分")
    private Integer score;

    @Schema(description = "评审意见")
    private String comment;
}
