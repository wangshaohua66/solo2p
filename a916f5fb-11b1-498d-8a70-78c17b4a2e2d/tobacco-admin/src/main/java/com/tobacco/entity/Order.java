package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("tobacco_order")
public class Order implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("order_no")
    private String orderNo;

    @TableField("retailer_id")
    private Long retailerId;

    @TableField("retailer_name")
    private String retailerName;

    @TableField("license_no")
    private String licenseNo;

    @TableField("order_period")
    private String orderPeriod;

    @TableField("total_quantity")
    private Integer totalQuantity;

    @TableField("total_amount")
    private BigDecimal totalAmount;

    @TableField("quota_limit")
    private Integer quotaLimit;

    @TableField("quota_used")
    private Integer quotaUsed;

    @TableField("status")
    private Integer status;

    @TableField("delivery_status")
    private Integer deliveryStatus;

    @TableField("county_id")
    private Long countyId;

    @TableField("station_id")
    private Long stationId;

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
