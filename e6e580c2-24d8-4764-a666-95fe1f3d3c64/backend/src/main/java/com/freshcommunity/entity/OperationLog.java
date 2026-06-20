package com.freshcommunity.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("operation_log")
public class OperationLog implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String userName;

    private String module;

    private String operation;

    private String method;

    private String params;

    private String result;

    private String ip;

    private Integer status;

    private Integer costTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
