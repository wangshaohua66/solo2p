package com.mw.scheduling.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class PlanRequest {

    @NotEmpty(message = "待收运节点不能为空")
    @Valid
    private List<PendingNodeDTO> nodes;

    private Double trafficFactor = 1.0;

    private Integer avgStopDurationMin = 15;

    private List<String> vehicleIds;

    private Double depotLat;

    private Double depotLng;
}
