package com.gov.specialequipment.vo;

import lombok.Data;

@Data
public class InspectionCoverageVO {

    private String code;

    private String name;

    private Long totalCount;

    private Long normalCount;

    private Long overdueCount;

    private Double coverageRate;
}
