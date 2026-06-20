package com.mw.tracking.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class GpsIngestDTO {

    @NotBlank(message = "车辆编号不能为空")
    private String vehicleId;

    private String manifestNo;

    @NotNull(message = "纬度不能为空")
    private Double lat;

    @NotNull(message = "经度不能为空")
    private Double lng;

    @DecimalMin(value = "0.0", message = "速度不能为负")
    private Double speed;

    private Double heading;

    @NotNull(message = "时间戳不能为空")
    private Long ts;
}
