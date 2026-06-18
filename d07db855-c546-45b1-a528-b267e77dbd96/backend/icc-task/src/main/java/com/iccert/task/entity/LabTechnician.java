package com.iccert.task.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("lab_technician")
public class LabTechnician extends BaseEntity {
    private Long userId;
    private String technicianName;
    private String title;
    private Long labId;
    private String labName;
    private Integer workload;
    private String status;
    private Integer certCount;
}
