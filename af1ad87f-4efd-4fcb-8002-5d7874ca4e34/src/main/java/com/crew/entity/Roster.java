package com.crew.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("roster")
public class Roster {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String rosterNo;

    private Long crewId;

    private Long flightId;

    private LocalDate rosterDate;

    private String dutyRole;

    private String status;

    private LocalDateTime reportTime;

    private LocalDateTime releaseTime;

    private Double dutyHours;

    private Integer timezoneCrossings;

    private Boolean isRedEye;

    private Double fatigueScore;

    private LocalDateTime approvedAt;

    private String approvedBy;

    private String swapReason;

    private Long swappedFrom;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
