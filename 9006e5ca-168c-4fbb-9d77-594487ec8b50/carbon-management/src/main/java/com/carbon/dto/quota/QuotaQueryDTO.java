package com.carbon.dto.quota;

import lombok.Data;

@Data
public class QuotaQueryDTO {

    private Long enterpriseId;
    private String enterpriseCode;
    private Integer quotaYear;
    private String status;
    private Integer page = 1;
    private Integer size = 20;
}
