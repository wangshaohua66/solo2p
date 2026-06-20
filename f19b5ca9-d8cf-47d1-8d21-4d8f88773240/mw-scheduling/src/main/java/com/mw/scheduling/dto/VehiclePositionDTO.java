package com.mw.scheduling.dto;

import lombok.Data;

@Data
public class VehiclePositionDTO {

    private String vehicleId;
    private Double lat;
    private Double lng;
    private Long lastTs;
    private String status;
}
