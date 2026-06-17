package com.heritage.restoration.entity;

import com.heritage.restoration.enums.ProjectStatus;
import com.heritage.restoration.enums.RepairType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "restoration_projects")
@CompoundIndex(name = "idx_status_created", def = "{'status':1, 'createdAt':-1}")
@CompoundIndex(name = "idx_artifact_status", def = "{'artifactId':1, 'status':1}")
@CompoundIndex(name = "idx_supervisor_status", def = "{'supervisorId':1, 'status':1}")
public class RestorationProject {
    @Id
    private String id;

    @Indexed(unique = true)
    private String projectCode;

    private String projectName;

    @Indexed
    private String artifactId;
    private String artifactCode;
    private String artifactName;

    private List<RepairType> repairTypes;

    @Indexed
    private ProjectStatus status;

    private Integer progress;

    private String level;

    private String supervisorId;
    private String supervisorName;

    private List<String> restorerIds;
    private List<String> restorerNames;

    private String institution;

    private String description;

    private String planContent;

    private BigDecimal budget;

    private BigDecimal actualCost;

    private LocalDateTime plannedStartTime;
    private LocalDateTime plannedEndTime;

    private LocalDateTime actualStartTime;
    private LocalDateTime actualEndTime;

    private LocalDateTime acceptTime;
    private String acceptResult;

    private String creatorId;
    private String creatorName;

    @Builder.Default
    private Boolean deleted = false;

    @Builder.Default
    private List<String> tags = new ArrayList<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
