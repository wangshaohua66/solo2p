package com.crew.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("roster_plan")
public class RosterPlan {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String planNo;

    private LocalDate month;

    private String status;

    private Integer totalFlights;

    private Integer totalCrewAssigned;

    private Integer violationCount;

    private Double avgFatigueScore;

    private String generatedBy;

    private LocalDateTime generatedAt;

    private LocalDateTime approvedAt;

    private String approvedBy;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
