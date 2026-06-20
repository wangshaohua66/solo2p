package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("quota_adjust_record")
public class QuotaAdjustRecord implements Serializable {

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

    @TableField("adjust_type")
    private String adjustType;

    @TableField("before_coefficient")
    private BigDecimal beforeCoefficient;

    @TableField("after_coefficient")
    private BigDecimal afterCoefficient;

    @TableField("adjust_ratio")
    private BigDecimal adjustRatio;

    @TableField("reason")
    private String reason;

    @TableField("related_id")
    private Long relatedId;

    @TableField("related_type")
    private String relatedType;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("operator_name")
    private String operatorName;

    @TableField("county_id")
    private Long countyId;

    @TableField("station_id")
    private Long stationId;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
