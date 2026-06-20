package com.design.collaboration.dto;

import com.design.collaboration.enums.ProjectStage;
import com.design.collaboration.enums.ProjectStatus;
import com.design.collaboration.enums.ProjectType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Schema(description = "创建项目请求")
public class ProjectCreateRequest {

    @NotBlank(message = "项目名称不能为空")
    @Schema(description = "项目名称", required = true)
    private String name;

    @NotNull(message = "项目类型不能为空")
    @Schema(description = "项目类型", required = true)
    private ProjectType type;

    @NotNull(message = "设计阶段不能为空")
    @Schema(description = "设计阶段", required = true)
    private ProjectStage stage;

    @Schema(description = "项目状态")
    private ProjectStatus status = ProjectStatus.PENDING;

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

    @Schema(description = "项目描述")
    private String description;
}
