package com.emergency.incident.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("incident_archive")
public class IncidentArchive extends BaseEntity {

    private Long incidentId;

    private String archiveNo;

    private String archiveType;

    private Integer archiveStatus;

    private Long archivedBy;

    private LocalDateTime archivedAt;

    private String archiveRemark;
}
