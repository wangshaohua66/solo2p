package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("violation_record")
public class ViolationRecord implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("record_no")
    private String recordNo;

    @TableField("task_id")
    private Long taskId;

    @TableField("retailer_id")
    private Long retailerId;

    @TableField("retailer_name")
    private String retailerName;

    @TableField("license_no")
    private String licenseNo;

    @TableField("violation_type")
    private Integer violationType;

    @TableField("violation_type_name")
    private String violationTypeName;

    @TableField("severity")
    private String severity;

    @TableField("description")
    private String description;

    @TableField("inspector_id")
    private Long inspectorId;

    @TableField("inspector_name")
    private String inspectorName;

    @TableField("county_id")
    private Long countyId;

    @TableField("station_id")
    private Long stationId;

    @TableField("deduct_points")
    private Integer deductPoints;

    @TableField("has_triggered_penalty")
    private Integer hasTriggeredPenalty;

    @TableField("penalty_type")
    private String penaltyType;

    @TableField("status")
    private Integer status;

    @TableField("disposal_opinion")
    private String disposalOpinion;

    @TableField("disposal_time")
    private LocalDateTime disposalTime;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(value = "update_time", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableField("deleted")
    @TableLogic
    private Integer deleted;
}
