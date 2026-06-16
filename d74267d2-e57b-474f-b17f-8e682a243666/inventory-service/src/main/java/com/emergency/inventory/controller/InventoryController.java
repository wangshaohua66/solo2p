package com.emergency.inventory.controller;

import com.emergency.common.result.Result;
import com.emergency.inventory.dto.AllocationRouteResult;
import com.emergency.inventory.dto.StockLockRequest;
import com.emergency.inventory.entity.*;
import com.emergency.inventory.service.InventoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
@Tag(name = "物资仓储管理", description = "物资仓储、锁定、调拨接口")
public class InventoryController {

    private final InventoryService inventoryService;

    @PostMapping("/lock/calculate-route")
    @Operation(summary = "计算最优调拨路线")
    public Result<AllocationRouteResult> calculateOptimalRoute(@Valid @RequestBody StockLockRequest request) {
        return Result.success(inventoryService.calculateOptimalRoute(request));
    }

    @PostMapping("/lock")
    @Operation(summary = "锁定物资")
    public Result<List<Long>> lockStocks(@Valid @RequestBody StockLockRequest request) {
        return Result.success(inventoryService.lockStocks(request));
    }

    @PostMapping("/lock/{id}/unlock")
    @Operation(summary = "解锁物资")
    public Result<Boolean> unlockStock(
            @PathVariable Long id,
            @Parameter(description = "解锁原因") @RequestParam String reason) {
        return Result.success(inventoryService.unlockStock(id, reason));
    }

    @PostMapping("/lock/{id}/confirm")
    @Operation(summary = "确认调拨（扣减库存）")
    public Result<Boolean> confirmAllocation(@PathVariable Long id) {
        return Result.success(inventoryService.confirmAllocation(id));
    }

    @GetMapping("/lock/{id}")
    @Operation(summary = "获取锁定详情")
    public Result<StockLock> getLockById(@PathVariable Long id) {
        return Result.success(inventoryService.getLockById(id));
    }

    @GetMapping("/lock/incident/{incidentId}")
    @Operation(summary = "获取灾情关联的锁定记录")
    public Result<List<StockLock>> getLocksByIncidentId(@PathVariable Long incidentId) {
        return Result.success(inventoryService.getLocksByIncidentId(incidentId));
    }

    @GetMapping("/warehouses")
    @Operation(summary = "获取所有仓库")
    public Result<List<Warehouse>> getAllWarehouses() {
        return Result.success(inventoryService.getAllWarehouses());
    }

    @GetMapping("/warehouses/{id}")
    @Operation(summary = "获取仓库详情")
    public Result<Warehouse> getWarehouseById(@PathVariable Long id) {
        return Result.success(inventoryService.getWarehouseById(id));
    }

    @GetMapping("/warehouses/nearby")
    @Operation(summary = "获取附近仓库")
    public Result<List<Warehouse>> getNearbyWarehouses(
            @Parameter(description = "经度") @RequestParam Double lng,
            @Parameter(description = "纬度") @RequestParam Double lat,
            @Parameter(description = "半径(公里)") @RequestParam(defaultValue = "50") Double radius,
            @Parameter(description = "返回数量") @RequestParam(defaultValue = "10") Integer limit) {
        return Result.success(inventoryService.getNearbyWarehouses(lng, lat, radius, limit));
    }

    @GetMapping("/materials")
    @Operation(summary = "获取所有物资品类")
    public Result<List<Material>> getAllMaterials() {
        return Result.success(inventoryService.getAllMaterials());
    }

    @GetMapping("/materials/{id}")
    @Operation(summary = "获取物资详情")
    public Result<Material> getMaterialById(@PathVariable Long id) {
        return Result.success(inventoryService.getMaterialById(id));
    }

    @GetMapping("/stocks/{id}")
    @Operation(summary = "获取库存详情")
    public Result<InventoryStock> getStockById(@PathVariable Long id) {
        return Result.success(inventoryService.getStockById(id));
    }

    @GetMapping("/stocks/warehouse/{warehouseId}")
    @Operation(summary = "获取仓库库存列表")
    public Result<List<InventoryStock>> getStockByWarehouseId(@PathVariable Long warehouseId) {
        return Result.success(inventoryService.getStockByWarehouseId(warehouseId));
    }

    @GetMapping("/stocks/material/{materialId}")
    @Operation(summary = "获取物资在各仓库的库存")
    public Result<List<InventoryStock>> getStockByMaterialId(@PathVariable Long materialId) {
        return Result.success(inventoryService.getStockByMaterialId(materialId));
    }

    @GetMapping("/stocks/available-nearby")
    @Operation(summary = "获取附近可用库存")
    public Result<List<InventoryStock>> getAvailableStockNearby(
            @Parameter(description = "物资ID") @RequestParam Long materialId,
            @Parameter(description = "需求数量") @RequestParam Integer quantity,
            @Parameter(description = "经度") @RequestParam Double lng,
            @Parameter(description = "纬度") @RequestParam Double lat,
            @Parameter(description = "半径(公里)") @RequestParam(defaultValue = "100") Double radius,
            @Parameter(description = "返回数量") @RequestParam(defaultValue = "10") Integer limit) {
        return Result.success(inventoryService.getAvailableStockNearby(
                materialId, quantity, lng, lat, radius, limit));
    }

    @GetMapping("/allocations/{id}")
    @Operation(summary = "获取调拨单详情")
    public Result<MaterialAllocation> getAllocationById(@PathVariable Long id) {
        return Result.success(inventoryService.getAllocationById(id));
    }

    @GetMapping("/allocations/incident/{incidentId}")
    @Operation(summary = "获取灾情关联的调拨单")
    public Result<List<MaterialAllocation>> getAllocationsByIncidentId(@PathVariable Long incidentId) {
        return Result.success(inventoryService.getAllocationsByIncidentId(incidentId));
    }

    @PutMapping("/allocations/{id}/status")
    @Operation(summary = "更新调拨单状态")
    public Result<MaterialAllocation> updateAllocationStatus(
            @PathVariable Long id,
            @Parameter(description = "状态:0-草稿 1-已锁定 2-已出库 3-已送达 4-已完成") @RequestParam Integer status) {
        return Result.success(inventoryService.updateAllocationStatus(id, status));
    }
}
