package com.freshcommunity.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("group_leader")
public class GroupLeader implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String phone;

    private Long communityId;

    private String idCard;

    private BigDecimal commissionRate;

    private BigDecimal totalCommission;

    private BigDecimal availableCommission;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
