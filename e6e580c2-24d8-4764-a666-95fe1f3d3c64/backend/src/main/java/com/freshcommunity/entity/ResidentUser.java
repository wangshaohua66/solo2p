package com.freshcommunity.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("resident_user")
public class ResidentUser implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;

    private String phone;

    private String password;

    private String nickname;

    private String avatar;

    private Long communityId;

    private Integer level;

    private Integer points;

    private BigDecimal totalAmount;

    private Integer orderCount;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
