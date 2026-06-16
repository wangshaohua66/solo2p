package com.carbon.dto.emission;

import lombok.Data;

@Data
public class EmissionQueryDTO {

    private Long enterpriseId;
    private String enterpriseCode;
    private Integer reportYear;
    private Integer reportMonth;
    private String status;
    private Integer page = 1;
    private Integer size = 20;
}
