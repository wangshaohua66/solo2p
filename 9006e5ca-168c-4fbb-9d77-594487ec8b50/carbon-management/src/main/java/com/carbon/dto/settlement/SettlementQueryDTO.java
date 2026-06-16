package com.carbon.dto.settlement;

import lombok.Data;

@Data
public class SettlementQueryDTO {

    private Long enterpriseId;
    private String enterpriseCode;
    private Integer settlementYear;
    private String status;
    private Integer page = 1;
    private Integer size = 20;
}
