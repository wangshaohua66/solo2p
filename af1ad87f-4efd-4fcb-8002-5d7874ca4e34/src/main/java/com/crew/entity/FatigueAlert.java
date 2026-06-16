package com.crew.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("fatigue_alert")
public class FatigueAlert {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long crewId;

    private Long dutyRecordId;

    private String alertLevel;

    private Double fatigueScore;

    private Double dutyRatio;

    private String message;

    private String status;

    private LocalDateTime triggeredAt;

    private LocalDateTime resolvedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
