package com.emergency.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "地理位置坐标")
public class GeoPoint implements Serializable {

    @Schema(description = "经度", example = "116.397128")
    @NotNull(message = "经度不能为空")
    @DecimalMin(value = "-180", message = "经度范围-180到180")
    @DecimalMax(value = "180", message = "经度范围-180到180")
    private Double lng;

    @Schema(description = "纬度", example = "39.916527")
    @NotNull(message = "纬度不能为空")
    @DecimalMin(value = "-90", message = "纬度范围-90到90")
    @DecimalMax(value = "90", message = "纬度范围-90到90")
    private Double lat;

    public double distanceTo(GeoPoint other) {
        double earthRadius = 6371;
        double dLat = Math.toRadians(other.lat - this.lat);
        double dLng = Math.toRadians(other.lng - this.lng);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(this.lat)) * Math.cos(Math.toRadians(other.lat))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadius * c;
    }
}
