package com.gov.specialequipment.dto;

import com.gov.specialequipment.common.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class DeviceQueryDTO extends PageQuery {

    private String deviceCode;

    private String deviceName;

    private Integer deviceType;

    private Integer status;

    private Long useUnitId;

    private String regionCode;

    private String keyword;
}
