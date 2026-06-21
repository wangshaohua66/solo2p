package com.gov.specialequipment.dto;

import com.gov.specialequipment.common.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
public class InspectionPlanQueryDTO extends PageQuery {

    private String planNo;

    private Long deviceId;

    private String deviceCode;

    private Long agencyId;

    private Integer status;

    private LocalDate planDateStart;

    private LocalDate planDateEnd;
}
