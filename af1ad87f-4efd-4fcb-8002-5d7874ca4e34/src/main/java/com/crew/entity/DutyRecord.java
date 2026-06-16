package com.crew.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("duty_record")
public class DutyRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long crewId;

    private Long rosterId;

    private LocalDateTime checkInTime;

    private LocalDateTime checkOutTime;

    private Double actualDutyHours;

    private String status;

    private Boolean overtimeFlag;

    private Double fatigueScore;

    private Integer timezoneCrossings;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
