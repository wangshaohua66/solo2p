package com.freshcommunity.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("delivery_task")
public class DeliveryTask implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String taskNo;

    private LocalDate deliveryDate;

    private String vehicleNo;

    private String driverName;

    private String driverPhone;

    private Integer totalOrders;

    private BigDecimal totalAmount;

    private Integer status;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
