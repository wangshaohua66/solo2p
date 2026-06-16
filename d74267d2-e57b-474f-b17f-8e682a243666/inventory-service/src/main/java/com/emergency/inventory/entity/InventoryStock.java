package com.emergency.inventory.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("inventory_stock")
public class InventoryStock extends BaseEntity {

    private Long warehouseId;

    private Long materialId;

    private String materialCode;

    private String materialName;

    private Integer quantity;

    private Integer lockedQuantity;

    private Integer availableQuantity;

    private Integer warningThreshold;

    private LocalDateTime lastInboundAt;

    private LocalDateTime lastOutboundAt;

    private String batchNo;

    private LocalDateTime expireDate;

    private String remark;
}
