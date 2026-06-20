package com.design.collaboration.entity;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "客户确认记录")
public class ClientConfirmation {

    @Schema(description = "确认ID")
    private Long id;

    @Schema(description = "项目ID")
    private Long projectId;

    @Schema(description = "版本ID")
    private Long versionId;

    @Schema(description = "确认类型")
    private String confirmationType;

    @Schema(description = "是否确认")
    private Boolean confirmed;

    @Schema(description = "确认人ID")
    private Long confirmedBy;

    @Schema(description = "确认时间")
    private LocalDateTime confirmedAt;

    @Schema(description = "确认时IP地址")
    private String ipAddress;

    @Schema(description = "备注")
    private String remark;
}
