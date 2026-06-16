package com.emergency.inventory.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("material_allocation")
public class MaterialAllocation extends BaseEntity {

    private String allocationNo;

    private Long incidentId;

    private Long dispatchPlanId;

    private Long fromWarehouseId;

    private Long toWarehouseId;

    private Long materialId;

    private Integer quantity;

    private BigDecimal estimatedDistance;

    private Integer estimatedDuration;

    private String routePlan;

    private String transportMode;

    private String carrier;

    private String driverName;

    private String driverPhone;

    private String vehicleNo;

    private LocalDateTime departedAt;

    private LocalDateTime arrivedAt;

    private Integer status;

    private String remark;
}
