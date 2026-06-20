package com.freshcommunity.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("product_community_stock")
public class ProductCommunityStock implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long productId;

    private Long communityId;

    private Integer stock;

    private Integer lockedStock;

    private Integer soldCount;

    private BigDecimal price;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
