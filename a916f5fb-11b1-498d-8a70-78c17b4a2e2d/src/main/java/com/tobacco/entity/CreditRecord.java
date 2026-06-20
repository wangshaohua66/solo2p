package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("credit_record")
public class CreditRecord implements Serializable {

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

    @TableField("change_type")
    private String changeType;

    @TableField("change_reason")
    private String changeReason;

    @TableField("source_id")
    private Long sourceId;

    @TableField("source_type")
    private String sourceType;

    @TableField("before_score")
    private Integer beforeScore;

    @TableField("change_score")
    private Integer changeScore;

    @TableField("after_score")
    private Integer afterScore;

    @TableField("before_level")
    private String beforeLevel;

    @TableField("after_level")
    private String afterLevel;

    @TableField("county_id")
    private Long countyId;

    @TableField("station_id")
    private Long stationId;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("operator_name")
    private String operatorName;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField("deleted")
    @TableLogic
    private Integer deleted;
}
