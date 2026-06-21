package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("emergency_resource")
public class EmergencyResource extends BaseEntity {

    private String resourceType;

    private String resourceName;

    private Long organizationId;

    private String organizationName;

    private String contactPerson;

    private String contactPhone;

    private String address;

    private String regionCode;

    private Double longitude;

    private Double latitude;

    private Integer quantity;

    private String capability;

    private Integer status;

    private String remark;
}
