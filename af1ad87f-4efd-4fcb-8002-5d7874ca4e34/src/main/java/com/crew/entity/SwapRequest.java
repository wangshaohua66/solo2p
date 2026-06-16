package com.crew.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("swap_request")
public class SwapRequest {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long rosterId;

    private Long originalCrewId;

    private Long targetCrewId;

    private String reason;

    private String urgency;

    private String status;

    private String reviewComment;

    private LocalDateTime reviewedAt;

    private String reviewedBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
