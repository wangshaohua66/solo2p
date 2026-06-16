package com.crew.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("qualification")
public class Qualification {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long crewId;

    private String qualType;

    private String qualCode;

    private String aircraftType;

    private LocalDate issueDate;

    private LocalDate expiryDate;

    private String status;

    private String languageLevel;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
