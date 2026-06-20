package com.freshcommunity.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("delivery_detail")
public class DeliveryDetail implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long taskId;

    private Long orderId;

    private String orderNo;

    private Long communityId;

    private String communityName;

    private Integer sortOrder;

    private Integer status;

    private LocalDateTime arriveTime;

    private LocalDateTime confirmTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableLogic
    private Integer deleted;
}
