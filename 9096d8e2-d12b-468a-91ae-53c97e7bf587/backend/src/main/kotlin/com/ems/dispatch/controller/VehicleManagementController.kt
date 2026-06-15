package com.ems.dispatch.controller

import com.ems.dispatch.dto.ApiResponse
import com.ems.dispatch.dto.PageResponse
import com.ems.dispatch.entity.VehicleMaintenance
import com.ems.dispatch.service.VehicleManagementService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/vehicle-management")
@Tag(name = "车辆管理", description = "救护车信息、维保记录、耗材库存管理相关API")
class VehicleManagementController(
    private val vehicleManagementService: VehicleManagementService
) {
    @PostMapping("/ambulances")
    @Operation(
        summary = "新增救护车",
        description = "录入新的救护车信息"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "创建成功"),
        ApiResponse(responseCode = "400", description = "车牌号已存在或参数错误")
    )
    fun createAmbulance(
        @Valid @RequestBody request: VehicleManagementService.AmbulanceCreateRequest
    ): ResponseEntity<ApiResponse<VehicleManagementService.AmbulanceDto>> {
        val result = vehicleManagementService.createAmbulance(request)
        return ResponseEntity.ok(ApiResponse.success(result, "救护车创建成功"))
    }

    @PutMapping("/ambulances/{id}")
    @Operation(
        summary = "更新救护车信息",
        description = "更新救护车的基本信息、状态、司机信息等"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "更新成功"),
        ApiResponse(responseCode = "404", description = "救护车不存在")
    )
    fun updateAmbulance(
        @Parameter(description = "救护车ID") @PathVariable id: Long,
        @Valid @RequestBody request: VehicleManagementService.AmbulanceUpdateRequest
    ): ResponseEntity<ApiResponse<VehicleManagementService.AmbulanceDto>> {
        val result = vehicleManagementService.updateAmbulance(id, request)
        return ResponseEntity.ok(ApiResponse.success(result, "救护车信息更新成功"))
    }

    @GetMapping("/ambulances/{id}")
    @Operation(
        summary = "获取救护车详情",
        description = "获取指定救护车的详细信息"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "查询成功"),
        ApiResponse(responseCode = "404", description = "救护车不存在")
    )
    fun getAmbulance(
        @Parameter(description = "救护车ID") @PathVariable id: Long
    ): ResponseEntity<ApiResponse<VehicleManagementService.AmbulanceDto>> {
        val result = vehicleManagementService.getAmbulance(id)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/ambulances")
    @Operation(
        summary = "获取救护车列表",
        description = "分页获取所有救护车列表，支持按状态筛选"
    )
    fun getAllAmbulances(
        @Parameter(description = "车辆状态") @RequestParam(required = false) status: String?,
        @Parameter(description = "页码") @RequestParam(defaultValue = "0") page: Int,
        @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<PageResponse<VehicleManagementService.AmbulanceDto>>> {
        val result = vehicleManagementService.getAllAmbulances(status, page, size)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @PostMapping("/maintenance")
    @Operation(
        summary = "记录维保信息",
        description = "记录车辆的维保信息，包括常规保养、故障维修等"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "记录成功"),
        ApiResponse(responseCode = "404", description = "救护车不存在")
    )
    fun createMaintenance(
        @Valid @RequestBody request: VehicleManagementService.MaintenanceCreateRequest
    ): ResponseEntity<ApiResponse<VehicleMaintenance>> {
        val result = vehicleManagementService.createMaintenance(request)
        return ResponseEntity.ok(ApiResponse.success(result, "维保记录创建成功"))
    }

    @GetMapping("/ambulances/{ambulanceId}/maintenance")
    @Operation(
        summary = "获取车辆维保历史",
        description = "查询指定救护车的所有维保记录"
    )
    fun getMaintenanceHistory(
        @Parameter(description = "救护车ID") @PathVariable ambulanceId: Long
    ): ResponseEntity<ApiResponse<List<VehicleMaintenance>>> {
        val result = vehicleManagementService.getMaintenanceHistory(ambulanceId)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @PostMapping("/supplies")
    @Operation(
        summary = "新增耗材",
        description = "录入新的车载耗材信息"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "创建成功"),
        ApiResponse(responseCode = "404", description = "救护车不存在")
    )
    fun createSupply(
        @Valid @RequestBody request: VehicleManagementService.SupplyCreateRequest
    ): ResponseEntity<ApiResponse<VehicleManagementService.SupplyDto>> {
        val result = vehicleManagementService.createSupply(request)
        return ResponseEntity.ok(ApiResponse.success(result, "耗材创建成功"))
    }

    @PutMapping("/supplies/{id}")
    @Operation(
        summary = "更新耗材信息",
        description = "更新耗材的库存、有效期等信息"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "更新成功"),
        ApiResponse(responseCode = "404", description = "耗材不存在")
    )
    fun updateSupply(
        @Parameter(description = "耗材ID") @PathVariable id: Long,
        @Valid @RequestBody request: VehicleManagementService.SupplyUpdateRequest
    ): ResponseEntity<ApiResponse<VehicleManagementService.SupplyDto>> {
        val result = vehicleManagementService.updateSupply(id, request)
        return ResponseEntity.ok(ApiResponse.success(result, "耗材信息更新成功"))
    }

    @GetMapping("/supplies")
    @Operation(
        summary = "查询耗材列表",
        description = "支持按救护车、分类、状态筛选耗材列表"
    )
    fun getSupplies(
        @Parameter(description = "救护车ID") @RequestParam(required = false) ambulanceId: Long?,
        @Parameter(description = "耗材分类") @RequestParam(required = false) category: String?,
        @Parameter(description = "状态") @RequestParam(required = false) status: String?
    ): ResponseEntity<ApiResponse<List<VehicleManagementService.SupplyDto>>> {
        val result = vehicleManagementService.getSupplies(ambulanceId, category, status)
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
