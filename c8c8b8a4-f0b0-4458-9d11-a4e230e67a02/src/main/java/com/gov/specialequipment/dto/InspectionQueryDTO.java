package com.gov.specialequipment.dto;

import com.gov.specialequipment.common.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
public class InspectionQueryDTO extends PageQuery {

    private String inspectionNo;

    private Long deviceId;

    private String deviceCode;

    private Integer deviceType;

    private Long agencyId;

    private Integer conclusion;

    private Integer status;

    private LocalDate startDate;

    private LocalDate endDate;
}
