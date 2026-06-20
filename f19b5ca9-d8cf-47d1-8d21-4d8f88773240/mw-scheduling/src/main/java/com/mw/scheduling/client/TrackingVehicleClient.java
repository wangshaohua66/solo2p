package com.mw.scheduling.client;

import com.mw.common.response.ApiResponse;
import com.mw.scheduling.dto.VehiclePositionDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "mw-tracking", contextId = "trackingVehicleClient")
public interface TrackingVehicleClient {

    @GetMapping("/tracking/vehicles/{vehicleId}/position")
    ApiResponse<VehiclePositionDTO> getPosition(@PathVariable("vehicleId") String vehicleId);
}
