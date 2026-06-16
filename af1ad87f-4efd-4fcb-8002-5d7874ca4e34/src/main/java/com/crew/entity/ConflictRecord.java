package com.crew.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("conflict_record")
public class ConflictRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long rosterId;

    private Long crewId;

    private String conflictType;

    private String description;

    private String suggestion;

    private String status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
