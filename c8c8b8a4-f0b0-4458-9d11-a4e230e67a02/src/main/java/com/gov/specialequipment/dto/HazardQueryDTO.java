package com.gov.specialequipment.dto;

import com.gov.specialequipment.common.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
public class HazardQueryDTO extends PageQuery {

    private String hazardNo;

    private Long deviceId;

    private String deviceCode;

    private Integer deviceType;

    private Long useUnitId;

    private Integer hazardLevel;

    private Integer status;

    private LocalDate startDate;

    private LocalDate endDate;

    private Boolean escalated;
}
