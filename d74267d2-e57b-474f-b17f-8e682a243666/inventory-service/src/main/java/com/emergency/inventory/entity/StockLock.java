package com.emergency.inventory.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("stock_lock")
public class StockLock extends BaseEntity {

    private String lockNo;

    private Long incidentId;

    private Long dispatchPlanId;

    private Long warehouseId;

    private Long materialId;

    private Integer lockQuantity;

    private BigDecimal estimatedCost;

    private LocalDateTime lockExpireAt;

    private Integer status;

    private String lockReason;

    private String unlockReason;

    private LocalDateTime unlockedAt;
}
