package com.design.collaboration.entity;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "设计版本")
public class DesignVersion {

    @Schema(description = "版本ID")
    private Long id;

    @Schema(description = "项目ID")
    private Long projectId;

    @Schema(description = "项目名称")
    private transient String projectName;

    @Schema(description = "任务ID")
    private Long taskId;

    @Schema(description = "版本号")
    private String versionNo;

    @Schema(description = "文件名")
    private String fileName;

    @Schema(description = "文件大小（字节）")
    private Long fileSize;

    @Schema(description = "文件存储路径")
    private String filePath;

    @Schema(description = "上传人ID")
    private Long uploadedBy;

    @Schema(description = "上传人姓名")
    private transient String uploadedByName;

    @Schema(description = "修改说明")
    private String description;

    @Schema(description = "是否已发布")
    private Boolean isReleased;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}
