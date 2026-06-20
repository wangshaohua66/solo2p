package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("inspection_task")
public class InspectionTask implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("task_no")
    private String taskNo;

    @TableField("task_type")
    private String taskType;

    @TableField("retailer_id")
    private Long retailerId;

    @TableField("retailer_name")
    private String retailerName;

    @TableField("license_no")
    private String licenseNo;

    @TableField("inspector_id")
    private Long inspectorId;

    @TableField("inspector_name")
    private String inspectorName;

    @TableField("risk_level")
    private String riskLevel;

    @TableField("grid_id")
    private Long gridId;

    @TableField("county_id")
    private Long countyId;

    @TableField("station_id")
    private Long stationId;

    @TableField("plan_date")
    private LocalDateTime planDate;

    @TableField("actual_date")
    private LocalDateTime actualDate;

    @TableField("status")
    private Integer status;

    @TableField("has_violation")
    private Integer hasViolation;

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
