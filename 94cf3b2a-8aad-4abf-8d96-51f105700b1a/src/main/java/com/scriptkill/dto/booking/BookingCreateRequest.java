package com.scriptkill.dto.booking;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "创建预约请求")
public class BookingCreateRequest {

    @Schema(description = "会话ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "1")
    @NotNull(message = "会话ID不能为空")
    private Long sessionId;

    @Schema(description = "玩家ID（用户ID）", requiredMode = Schema.RequiredMode.REQUIRED, example = "5")
    @NotNull(message = "玩家ID不能为空")
    private Long playerId;

    @Schema(description = "角色偏好1")
    private Long characterPreference1;

    @Schema(description = "角色偏好2")
    private Long characterPreference2;

    @Schema(description = "角色偏好3")
    private Long characterPreference3;

    @Schema(description = "备注")
    private String notes;

    @Schema(description = "支付方式: WECHAT, ALIPAY, CASH", example = "WECHAT")
    private String paymentMethod;
}
