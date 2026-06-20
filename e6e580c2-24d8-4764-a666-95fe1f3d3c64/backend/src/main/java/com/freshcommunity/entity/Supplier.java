package com.freshcommunity.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("supplier")
public class Supplier implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String contactPerson;

    private String phone;

    private String address;

    private String businessLicense;

    private Integer settlementCycle;

    private BigDecimal totalSettlement;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
