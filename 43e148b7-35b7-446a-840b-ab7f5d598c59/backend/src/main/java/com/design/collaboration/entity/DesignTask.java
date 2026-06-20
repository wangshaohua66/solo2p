package com.design.collaboration.entity;

import com.design.collaboration.enums.ProfessionType;
import com.design.collaboration.enums.ProjectStage;
import com.design.collaboration.enums.TaskStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Schema(description = "设计任务")
public class DesignTask {

    @Schema(description = "任务ID")
    private Long id;

    @Schema(description = "项目ID")
    private Long projectId;

    @Schema(description = "项目名称")
    private transient String projectName;

    @Schema(description = "设计阶段")
    private ProjectStage stage;

    @Schema(description = "专业")
    private ProfessionType profession;

    @Schema(description = "任务名称")
    private String name;

    @Schema(description = "任务描述")
    private String description;

    @Schema(description = "父任务ID")
    private Long parentId;

    @Schema(description = "负责人ID")
    private Long assigneeId;

    @Schema(description = "负责人姓名")
    private transient String assigneeName;

    @Schema(description = "任务状态")
    private TaskStatus status;

    @Schema(description = "进度百分比")
    private Integer progress;

    @Schema(description = "计划开始日期")
    private LocalDate plannedStartDate;

    @Schema(description = "计划完成日期")
    private LocalDate plannedEndDate;

    @Schema(description = "实际开始日期")
    private LocalDate actualStartDate;

    @Schema(description = "实际完成日期")
    private LocalDate actualEndDate;

    @Schema(description = "交付物要求")
    private String deliverables;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
