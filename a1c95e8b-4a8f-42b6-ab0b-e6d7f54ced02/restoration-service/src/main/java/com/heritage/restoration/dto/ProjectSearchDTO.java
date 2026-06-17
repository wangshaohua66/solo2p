package com.heritage.restoration.dto;

import com.heritage.restoration.enums.ProjectStatus;
import com.heritage.restoration.enums.RepairType;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class ProjectSearchDTO {
    private String keyword;
    private String artifactId;
    private List<ProjectStatus> statusList;
    private ProjectStatus status;
    private String supervisorId;
    private String restorerId;
    private String level;
    private List<RepairType> repairTypes;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String institution;
    private Boolean deleted = false;

    private Integer page = 0;
    private Integer size = 20;
    private String sortBy = "createdAt";
    private String sortDirection = "DESC";
}
