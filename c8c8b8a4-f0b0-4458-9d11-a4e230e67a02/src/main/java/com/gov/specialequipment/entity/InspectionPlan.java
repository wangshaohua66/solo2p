package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("inspection_plan")
public class InspectionPlan extends BaseEntity {

    private String planNo;

    private Long deviceId;

    private String deviceCode;

    private Long agencyId;

    private String agencyName;

    private LocalDate planDate;

    private Integer status;

    private LocalDateTime pushTime;

    private String remark;
}
