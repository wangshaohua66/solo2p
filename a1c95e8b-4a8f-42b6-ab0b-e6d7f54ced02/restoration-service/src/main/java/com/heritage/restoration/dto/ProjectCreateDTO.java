package com.heritage.restoration.dto;

import com.heritage.restoration.enums.ProjectStatus;
import com.heritage.restoration.enums.RepairType;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class ProjectCreateDTO {
    @NotBlank(message = "项目名称不能为空")
    private String projectName;

    @NotBlank(message = "文物ID不能为空")
    private String artifactId;

    private List<RepairType> repairTypes;

    private ProjectStatus status;

    private String level;

    private String supervisorId;

    private List<String> restorerIds;

    private String institution;

    private String description;

    private String planContent;

    private BigDecimal budget;

    private LocalDateTime plannedStartTime;
    private LocalDateTime plannedEndTime;

    private List<String> tags;
}
