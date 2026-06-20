package com.mw.scheduling.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PendingNodeDTO {

    @NotBlank(message = "机构编号不能为空")
    private String orgId;

    private String orgName;

    @NotBlank(message = "联单号不能为空")
    private String manifestNo;

    @NotNull(message = "暂存重量不能为空")
    @DecimalMin(value = "0.01", message = "重量必须大于0")
    private Double weightKg;

    @NotNull(message = "纬度不能为空")
    private Double lat;

    @NotNull(message = "经度不能为空")
    private Double lng;

    private String address;
}
