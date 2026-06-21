package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("use_unit")
public class UseUnit extends BaseEntity {

    private String unitCode;

    private String unitName;

    private String legalPerson;

    private String contactPerson;

    private String contactPhone;

    private String address;

    private String regionCode;

    private String unifiedSocialCreditCode;

    private Integer status;
}
