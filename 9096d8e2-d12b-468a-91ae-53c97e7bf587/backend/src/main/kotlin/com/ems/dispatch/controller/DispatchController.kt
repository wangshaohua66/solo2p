package com.ems.dispatch.controller

import com.ems.dispatch.dto.*
import com.ems.dispatch.entity.User
import com.ems.dispatch.service.AmbulanceLocationService
import com.ems.dispatch.service.DispatchService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime

@RestController
@RequestMapping("/dispatch")
@Tag(name = "急救调度", description = "急救事件调度、派车、状态管理相关API")
class DispatchController(
    private val dispatchService: DispatchService,
    private val ambulanceLocationService: AmbulanceLocationService,
    private val userRepository: com.ems.dispatch.repository.UserRepository
) {
    @PostMapping("/emergency-call")
    @Operation(
        summary = "创建急救呼入事件",
        description = "调度员接听120电话后，录入呼救信息并创建急救事件"
    )
    @ApiResponses(
        ApiResponse(
            responseCode = "200", description = "创建成功",
            content = [Content(schema = Schema(implementation = DispatchEventDetail::class))]
        ),
        ApiResponse(responseCode = "400", description = "请求参数错误"),
        ApiResponse(responseCode = "401", description = "未授权"),
        ApiResponse(responseCode = "403", description = "无权限")
    )
    fun createEmergencyCall(
        @Valid @RequestBody request: EmergencyCallRequest,
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<ApiResponse<DispatchEventDetail>> {
        val dispatcher = userRepository.findByUsername(userDetails.username)!!
        val result = dispatchService.createEmergencyCall(request, dispatcher)
        return ResponseEntity.ok(ApiResponse.success(result, "急救事件创建成功"))
    }

    @GetMapping("/nearby-vehicles")
    @Operation(
        summary = "查询附近可用车辆",
        description = "基于PostGIS计算呼救点指定范围内可用车辆，按距离排序推荐"
    )
    @ApiResponses(
        ApiResponse(
            responseCode = "200", description = "查询成功",
            content = [Content(schema = Schema(implementation = VehicleRecommendation::class))]
        )
    )
    fun findNearbyVehicles(
        @Parameter(description = "经度") @RequestParam longitude: Double,
        @Parameter(description = "纬度") @RequestParam latitude: Double,
        @Parameter(description = "搜索半径（公里）") @RequestParam(defaultValue = "5.0") radiusKm: Double,
        @Parameter(description = "车辆状态") @RequestParam(defaultValue = "AVAILABLE") statuses: List<String>
    ): ResponseEntity<ApiResponse<List<VehicleRecommendation>>> {
        val request = NearbyVehicleRequest(longitude, latitude, radiusKm, statuses)
        val result = dispatchService.findNearbyVehicles(request)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @PostMapping("/dispatch")
    @Operation(
        summary = "派车指令",
        description = "调度员指定救护车执行急救任务，支持手动改派与跨区协调"
    )
    @ApiResponses(
        ApiResponse(
            responseCode = "200", description = "派车成功",
            content = [Content(schema = Schema(implementation = DispatchEventDetail::class))]
        ),
        ApiResponse(responseCode = "400", description = "车辆不可用或参数错误"),
        ApiResponse(responseCode = "404", description = "急救事件或车辆不存在")
    )
    fun dispatchVehicle(
        @Valid @RequestBody request: DispatchCommandRequest,
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<ApiResponse<DispatchEventDetail>> {
        val dispatcher = userRepository.findByUsername(userDetails.username)!!
        val result = dispatchService.dispatchVehicle(request, dispatcher)
        return ResponseEntity.ok(ApiResponse.success(result, "派车成功"))
    }

    @PatchMapping("/events/{eventId}/status")
    @Operation(
        summary = "更新事件状态",
        description = "更新急救事件状态（出车、到达现场、离开现场、到达医院、完成等）"
    )
    @ApiResponses(
        ApiResponse(
            responseCode = "200", description = "状态更新成功",
            content = [Content(schema = Schema(implementation = DispatchEventDetail::class))]
        ),
        ApiResponse(responseCode = "404", description = "急救事件不存在")
    )
    fun updateEventStatus(
        @Parameter(description = "急救事件ID") @PathVariable eventId: Long,
        @Valid @RequestBody request: EventStatusUpdateRequest
    ): ResponseEntity<ApiResponse<DispatchEventDetail>> {
        val result = dispatchService.updateEventStatus(eventId, request)
        return ResponseEntity.ok(ApiResponse.success(result, "状态更新成功"))
    }

    @GetMapping("/events/active")
    @Operation(
        summary = "获取活跃事件列表",
        description = "分页获取所有进行中的急救事件"
    )
    @ApiResponses(
        ApiResponse(
            responseCode = "200", description = "查询成功",
            content = [Content(schema = Schema(implementation = DispatchEventSummary::class))]
        )
    )
    fun getActiveEvents(
        @Parameter(description = "页码") @RequestParam(defaultValue = "0") page: Int,
        @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<PageResponse<DispatchEventSummary>>> {
        val result = dispatchService.getActiveEvents(page, size)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/events/{eventId}")
    @Operation(
        summary = "获取事件详情",
        description = "获取急救事件的详细信息，包括时间线"
    )
    @ApiResponses(
        ApiResponse(
            responseCode = "200", description = "查询成功",
            content = [Content(schema = Schema(implementation = DispatchEventDetail::class))]
        ),
        ApiResponse(responseCode = "404", description = "急救事件不存在")
    )
    fun getEventDetail(
        @Parameter(description = "急救事件ID") @PathVariable eventId: Long
    ): ResponseEntity<ApiResponse<DispatchEventDetail>> {
        val result = dispatchService.getEventDetail(eventId)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/events")
    @Operation(
        summary = "按时间范围查询事件",
        description = "支持按时间段分页查询历史急救事件"
    )
    @ApiResponses(
        ApiResponse(
            responseCode = "200", description = "查询成功",
            content = [Content(schema = Schema(implementation = DispatchEventSummary::class))]
        )
    )
    fun getEventsByDateRange(
        @Parameter(description = "开始时间") @RequestParam startDate: LocalDateTime,
        @Parameter(description = "结束时间") @RequestParam endDate: LocalDateTime,
        @Parameter(description = "页码") @RequestParam(defaultValue = "0") page: Int,
        @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<PageResponse<DispatchEventSummary>>> {
        val result = dispatchService.getEventsByDateRange(startDate, endDate, page, size)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/dashboard")
    @Operation(
        summary = "调度实时仪表盘",
        description = "获取调度中心实时统计数据（待处理、进行中、已完成、可用车辆数）"
    )
    fun getDashboard(): ResponseEntity<ApiResponse<Map<String, Any>>> {
        val result = dispatchService.getRealtimeDashboard()
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @PostMapping("/gps/report")
    @Operation(
        summary = "上报车辆GPS位置",
        description = "车载终端上报GPS位置数据，支持高并发（200台车辆同时上报）"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "上报成功"),
        ApiResponse(responseCode = "400", description = "参数错误")
    )
    fun reportGps(
        @Valid @RequestBody request: AmbulanceLocationService.GpsUpdateMessage
    ): ResponseEntity<ApiResponse<Boolean>> {
        val result = ambulanceLocationService.reportGpsUpdate(request)
        return ResponseEntity.ok(ApiResponse.success(result, "GPS上报成功"))
    }

    @GetMapping("/vehicles/{ambulanceId}/track")
    @Operation(
        summary = "获取车辆行驶轨迹",
        description = "按时间范围查询车辆的历史行驶轨迹"
    )
    @ApiResponses(
        ApiResponse(
            responseCode = "200", description = "查询成功",
            content = [Content(schema = Schema(implementation = LocationDto::class))]
        )
    )
    fun getVehicleTrack(
        @Parameter(description = "车辆ID") @PathVariable ambulanceId: Long,
        @Parameter(description = "开始时间") @RequestParam startTime: LocalDateTime,
        @Parameter(description = "结束时间") @RequestParam endTime: LocalDateTime
    ): ResponseEntity<ApiResponse<List<LocationDto>>> {
        val result = ambulanceLocationService.getVehicleTrack(ambulanceId, startTime, endTime)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/vehicles/locations")
    @Operation(
        summary = "获取所有车辆实时位置",
        description = "获取所有救护车的最新位置信息，用于地图展示"
    )
    fun getAllVehiclesLocation(): ResponseEntity<ApiResponse<Map<Long, AmbulanceLocationService.VehicleStatusUpdate>>> {
        val result = ambulanceLocationService.getAllVehiclesLatestLocation()
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
