package com.emergency.dispatch.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dispatch_team_assignment")
public class TeamAssignment extends BaseEntity {

    private Long dispatchPlanId;

    private Long teamId;

    private String teamName;

    private String assignmentRole;

    private Integer teamCount;

    private LocalDateTime assignedAt;

    private LocalDateTime departedAt;

    private LocalDateTime arrivedAt;

    private LocalDateTime completedAt;

    private String status;

    private String conflictInfo;

    private String taskDetail;
}
