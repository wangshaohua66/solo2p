package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("delivery_plan")
public class DeliveryPlan implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("plan_no")
    private String planNo;

    @TableField("delivery_date")
    private LocalDateTime deliveryDate;

    @TableField("order_period")
    private String orderPeriod;

    @TableField("total_orders")
    private Integer totalOrders;

    @TableField("total_quantity")
    private Integer totalQuantity;

    @TableField("fleet_count")
    private Integer fleetCount;

    @TableField("vehicle_count")
    private Integer vehicleCount;

    @TableField("status")
    private Integer status;

    @TableField("calc_time")
    private BigDecimal calcTime;

    @TableField("county_id")
    private Long countyId;

    @TableField("remark")
    private String remark;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(value = "update_time", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableField("deleted")
    @TableLogic
    private Integer deleted;
}
