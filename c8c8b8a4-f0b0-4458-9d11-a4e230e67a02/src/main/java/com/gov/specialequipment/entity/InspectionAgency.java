package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("inspection_agency")
public class InspectionAgency extends BaseEntity {

    private String agencyCode;

    private String agencyName;

    private String legalPerson;

    private String contactPerson;

    private String contactPhone;

    private String address;

    private String regionCode;

    private String qualificationNumber;

    private Integer status;
}
