package com.design.collaboration.entity;

import com.design.collaboration.enums.ProfessionType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "项目专业负责人")
public class ProjectProfessional {

    @Schema(description = "ID")
    private Long id;

    @Schema(description = "项目ID")
    private Long projectId;

    @Schema(description = "专业类型")
    private ProfessionType profession;

    @Schema(description = "专业负责人ID")
    private Long professionalLeadId;

    @Schema(description = "专业负责人姓名")
    private transient String professionalLeadName;

    @Schema(description = "专业进度")
    private Integer progress;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
