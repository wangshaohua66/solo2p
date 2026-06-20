package com.design.collaboration.dto;

import com.design.collaboration.enums.ProfessionType;
import com.design.collaboration.enums.ProjectStage;
import com.design.collaboration.enums.TaskStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
@Schema(description = "创建任务请求")
public class TaskCreateRequest {

    @NotNull(message = "项目ID不能为空")
    @Schema(description = "项目ID", required = true)
    private Long projectId;

    @NotNull(message = "设计阶段不能为空")
    @Schema(description = "设计阶段", required = true)
    private ProjectStage stage;

    @NotNull(message = "专业不能为空")
    @Schema(description = "专业", required = true)
    private ProfessionType profession;

    @NotBlank(message = "任务名称不能为空")
    @Schema(description = "任务名称", required = true)
    private String name;

    @Schema(description = "任务描述")
    private String description;

    @Schema(description = "父任务ID")
    private Long parentId;

    @Schema(description = "负责人ID")
    private Long assigneeId;

    @Schema(description = "任务状态")
    private TaskStatus status = TaskStatus.PENDING;

    @Schema(description = "进度百分比")
    private Integer progress = 0;

    @Schema(description = "计划开始日期")
    private LocalDate plannedStartDate;

    @Schema(description = "计划完成日期")
    private LocalDate plannedEndDate;

    @Schema(description = "交付物要求")
    private String deliverables;
}
