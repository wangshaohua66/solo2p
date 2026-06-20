package com.freshcommunity.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("product")
public class Product implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private Long categoryId;

    private Long supplierId;

    private String description;

    private String imageUrl;

    private BigDecimal purchasePrice;

    private BigDecimal sellingPrice;

    private String unit;

    private Integer totalStock;

    private Integer soldCount;

    private Integer status;

    private Integer auditStatus;

    private String auditRemark;

    private Integer sortOrder;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
