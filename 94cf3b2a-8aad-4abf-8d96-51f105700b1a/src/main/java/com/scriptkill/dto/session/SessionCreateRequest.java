package com.scriptkill.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "创建开本会话请求")
public class SessionCreateRequest {

    @Schema(description = "剧本ID", example = "1", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "剧本ID不能为空")
    private Long scriptId;

    @Schema(description = "DM用户ID", example = "3", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "DM ID不能为空")
    private Long dmId;

    @Schema(description = "开始时间", example = "2024-12-25T14:00:00")
    private LocalDateTime startTime;

    @Schema(description = "房间号", example = "A101")
    private String roomNumber;

    @Schema(description = "最大玩家数", example = "6")
    private Integer maxPlayers;

    @Schema(description = "难度系数", example = "1.0")
    private Double difficultyFactor;

    @Schema(description = "定金金额", example = "50")
    private Integer depositAmount;

    @Schema(description = "单人价格", example = "128")
    private Integer pricePerPerson;

    @Schema(description = "备注")
    private String notes;
}
