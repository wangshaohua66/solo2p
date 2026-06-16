package com.emergency.notification.dto;

import com.emergency.common.enums.NotificationChannel;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Schema(description = "通知发送请求")
public class NotificationSendRequest implements Serializable {

    @Schema(description = "通知标题", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "通知标题不能为空")
    private String title;

    @Schema(description = "通知内容", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "通知内容不能为空")
    private String content;

    @Schema(description = "通知摘要")
    private String summary;

    @Schema(description = "发送通道", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "发送通道不能为空")
    private List<NotificationChannel> channels;

    @Schema(description = "目标类型: USER-指定用户 ORG-组织 ROLE-角色 REGION-区域 ALL-全部")
    @NotBlank(message = "目标类型不能为空")
    private String targetType;

    @Schema(description = "目标ID列表")
    @NotEmpty(message = "目标ID不能为空")
    private List<Long> targetIds;

    @Schema(description = "灾情ID")
    private Long incidentId;

    @Schema(description = "调度方案ID")
    private Long dispatchPlanId;

    @Schema(description = "优先级:1-最高 5-最低")
    private Integer priority = 3;

    @Schema(description = "区域编码")
    private String regionCode;

    @Schema(description = "灾情等级")
    private Integer incidentLevel;

    @Schema(description = "定时发送时间")
    private LocalDateTime scheduledAt;

    @Schema(description = "过期时间")
    private LocalDateTime expiredAt;

    @Schema(description = "模板编码")
    private String templateCode;

    @Schema(description = "模板参数JSON")
    private String templateParams;

    @Schema(description = "回调地址")
    private String callbackUrl;
}
