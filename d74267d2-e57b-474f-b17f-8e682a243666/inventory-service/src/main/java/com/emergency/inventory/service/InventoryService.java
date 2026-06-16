package com.emergency.inventory.service;

import com.emergency.inventory.dto.AllocationRouteResult;
import com.emergency.inventory.dto.StockLockRequest;
import com.emergency.inventory.entity.*;

import java.util.List;

public interface InventoryService {

    AllocationRouteResult calculateOptimalRoute(StockLockRequest request);

    List<Long> lockStocks(StockLockRequest request);

    boolean unlockStock(Long lockId, String reason);

    boolean confirmAllocation(Long lockId);

    Warehouse getWarehouseById(Long id);

    List<Warehouse> getNearbyWarehouses(Double lng, Double lat, Double radius, Integer limit);

    Material getMaterialById(Long id);

    List<Material> getAllMaterials();

    InventoryStock getStockById(Long id);

    List<InventoryStock> getStockByWarehouseId(Long warehouseId);

    List<InventoryStock> getStockByMaterialId(Long materialId);

    List<InventoryStock> getAvailableStockNearby(Long materialId, Integer quantity,
            Double lng, Double lat, Double radius, Integer limit);

    List<StockLock> getLocksByIncidentId(Long incidentId);

    StockLock getLockById(Long id);

    List<MaterialAllocation> getAllocationsByIncidentId(Long incidentId);

    MaterialAllocation getAllocationById(Long id);

    MaterialAllocation updateAllocationStatus(Long id, Integer status);

    List<Warehouse> getAllWarehouses();
}
