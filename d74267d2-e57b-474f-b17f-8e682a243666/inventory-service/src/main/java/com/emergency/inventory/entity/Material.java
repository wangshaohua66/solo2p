package com.emergency.inventory.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("material")
public class Material extends BaseEntity {

    private String materialCode;

    private String materialName;

    private String category;

    private String specification;

    private String unit;

    private BigDecimal unitPrice;

    private String manufacturer;

    private Integer shelfLife;

    private String storageCondition;

    private String usageMethod;

    private String remark;
}
