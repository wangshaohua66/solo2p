package com.scriptkill.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "会话事件响应（事件溯源）")
public class SessionEventResponse {

    @Schema(description = "事件ID")
    private Long id;

    @Schema(description = "会话ID")
    private Long sessionId;

    @Schema(description = "事件类型")
    private String eventType;

    @Schema(description = "迁移前状态")
    private String fromStatus;

    @Schema(description = "迁移后状态")
    private String toStatus;

    @Schema(description = "触发者ID")
    private Long triggeredBy;

    @Schema(description = "事件数据（JSON）")
    private String eventData;

    @Schema(description = "事件描述")
    private String description;

    @Schema(description = "事件时间")
    private LocalDateTime eventTimestamp;

    @Schema(description = "IP地址")
    private String ipAddress;
}
