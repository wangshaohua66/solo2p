package com.mw.scheduling.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UrgentInsertRequest {

    @NotBlank(message = "联单号不能为空")
    private String manifestNo;

    @NotBlank(message = "机构编号不能为空")
    private String orgId;

    private String orgName;

    private Double weightKg;

    private Double lat;

    private Double lng;

    private String address;
}
