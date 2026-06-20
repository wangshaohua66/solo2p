package com.design.collaboration.entity;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "项目动态日志")
public class ProjectLog {

    @Schema(description = "日志ID")
    private Long id;

    @Schema(description = "项目ID")
    private Long projectId;

    @Schema(description = "操作类型")
    private String action;

    @Schema(description = "操作内容")
    private String content;

    @Schema(description = "操作人ID")
    private Long operatorId;

    @Schema(description = "操作人姓名")
    private String operatorName;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}
