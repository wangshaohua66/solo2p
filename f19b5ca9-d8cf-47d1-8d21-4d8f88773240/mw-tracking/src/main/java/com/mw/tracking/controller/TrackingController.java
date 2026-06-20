package com.mw.tracking.controller;

import com.mw.common.response.ApiResponse;
import com.mw.tracking.document.GpsPoint;
import com.mw.tracking.document.VehicleLocation;
import com.mw.tracking.dto.GpsBatchRequest;
import com.mw.tracking.dto.GpsIngestDTO;
import com.mw.tracking.service.VehicleTrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "车辆轨迹", description = "GPS上报、实时位置、历史轨迹回放")
@RestController
@RequestMapping("/tracking")
@RequiredArgsConstructor
public class TrackingController {

    private final VehicleTrackingService trackingService;

    @Operation(summary = "车载终端单条GPS上报")
    @PostMapping("/gps")
    public ApiResponse<GpsPoint> ingest(@Valid @RequestBody GpsIngestDTO dto) {
        return ApiResponse.success(trackingService.ingest(dto));
    }

    @Operation(summary = "批量GPS上报（高并发写入）")
    @PostMapping("/gps/batch")
    public ApiResponse<Integer> batchIngest(@Valid @RequestBody GpsBatchRequest request) {
        return ApiResponse.success(trackingService.batchIngest(request));
    }

    @Operation(summary = "查询车辆最新位置与ETA")
    @GetMapping("/vehicles/{vehicleId}/position")
    public ApiResponse<VehicleLocation> position(@PathVariable String vehicleId) {
        return ApiResponse.success(trackingService.getLatestPosition(vehicleId));
    }

    @Operation(summary = "历史轨迹回放")
    @GetMapping("/vehicles/{vehicleId}/track")
    public ApiResponse<List<GpsPoint>> track(@PathVariable String vehicleId,
                                             @RequestParam(required = false) Long from,
                                             @RequestParam(required = false) Long to) {
        return ApiResponse.success(trackingService.historyTrack(vehicleId, from, to));
    }
}
