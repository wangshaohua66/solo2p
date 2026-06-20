package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("delivery_route")
public class DeliveryRoute implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("plan_id")
    private Long planId;

    @TableField("route_no")
    private String routeNo;

    @TableField("fleet_id")
    private Long fleetId;

    @TableField("vehicle_no")
    private String vehicleNo;

    @TableField("driver_name")
    private String driverName;

    @TableField("delivery_count")
    private Integer deliveryCount;

    @TableField("total_load")
    private Integer totalLoad;

    @TableField("load_rate")
    private BigDecimal loadRate;

    @TableField("estimated_distance")
    private BigDecimal estimatedDistance;

    @TableField("estimated_duration")
    private BigDecimal estimatedDuration;

    @TableField("start_point")
    private String startPoint;

    @TableField("end_point")
    private String endPoint;

    @TableField("delivery_sequence")
    private String deliverySequence;

    @TableField("status")
    private Integer status;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField("deleted")
    @TableLogic
    private Integer deleted;
}
