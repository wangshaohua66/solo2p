package com.emergency.inventory.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.dto.GeoPoint;
import com.emergency.common.entity.BaseEntity;
import com.emergency.inventory.handler.GeoPointTypeHandler;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "warehouse", autoResultMap = true)
public class Warehouse extends BaseEntity {

    private String warehouseCode;

    private String warehouseName;

    private Integer warehouseType;

    private Long organizationId;

    private String regionCode;

    private String address;

    @TableField(typeHandler = GeoPointTypeHandler.class)
    private GeoPoint locationPoint;

    private String managerName;

    private String managerPhone;

    private Integer capacity;

    private Integer usedCapacity;

    private Integer status;

    private String remark;
}
