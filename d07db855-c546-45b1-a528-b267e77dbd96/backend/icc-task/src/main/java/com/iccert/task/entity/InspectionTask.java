package com.iccert.task.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("inspection_task")
public class InspectionTask extends BaseEntity {
    private String taskCode;
    private String taskTitle;
    private Long sampleId;
    private String sampleCode;
    private Long certTypeId;
    private String certTypeCode;
    private Long standardId;
    private String standardCode;
    private Long technicianId;
    private String technicianName;
    private Long equipmentId;
    private String equipmentName;
    private String priority;
    private String taskStatus;
    private Integer progress;
    private LocalDateTime assignTime;
    private LocalDateTime startTime;
    private LocalDateTime expectedFinishTime;
    private LocalDateTime actualFinishTime;
    private LocalDate deadline;
    private Integer isOverdueWarned;
    private Integer autoDispatched;
    private String dispatchAlgorithm;
    private String remark;
    private Long createBy;
}
