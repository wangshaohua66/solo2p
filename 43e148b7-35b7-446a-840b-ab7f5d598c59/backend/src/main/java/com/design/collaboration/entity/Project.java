package com.design.collaboration.entity;

import com.design.collaboration.enums.ProjectStage;
import com.design.collaboration.enums.ProjectStatus;
import com.design.collaboration.enums.ProjectType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Schema(description = "项目")
public class Project {

    @Schema(description = "项目ID")
    private Long id;

    @Schema(description = "项目编号")
    private String projectNo;

    @Schema(description = "项目名称")
    private String name;

    @Schema(description = "项目类型")
    private ProjectType type;

    @Schema(description = "设计阶段")
    private ProjectStage stage;

    @Schema(description = "项目状态")
    private ProjectStatus status;

    @Schema(description = "合同金额")
    private BigDecimal contractAmount;

    @Schema(description = "开始日期")
    private LocalDate startDate;

    @Schema(description = "结束日期")
    private LocalDate endDate;

    @Schema(description = "客户名称")
    private String clientName;

    @Schema(description = "客户联系人")
    private String clientContact;

    @Schema(description = "客户联系电话")
    private String clientPhone;

    @Schema(description = "项目经理ID")
    private Long projectManagerId;

    @Schema(description = "项目经理姓名")
    private transient String projectManagerName;

    @Schema(description = "项目描述")
    private String description;

    @Schema(description = "整体进度百分比")
    private Integer progress;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
