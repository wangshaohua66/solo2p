package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("quota_exceed_record")
public class QuotaExceedRecord implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("record_no")
    private String recordNo;

    @TableField("retailer_id")
    private Long retailerId;

    @TableField("retailer_name")
    private String retailerName;

    @TableField("license_no")
    private String licenseNo;

    @TableField("order_period")
    private String orderPeriod;

    @TableField("quota_limit")
    private Integer quotaLimit;

    @TableField("quota_used")
    private Integer quotaUsed;

    @TableField("request_quantity")
    private Integer requestQuantity;

    @TableField("exceed_quantity")
    private Integer exceedQuantity;

    @TableField("county_id")
    private Long countyId;

    @TableField("station_id")
    private Long stationId;

    @TableField("remark")
    private String remark;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
