package com.emergency.inventory.service.impl;

import com.emergency.common.dto.GeoPoint;
import com.emergency.common.dto.LoginUser;
import com.emergency.common.exception.BusinessException;
import com.emergency.common.result.ResultCode;
import com.emergency.common.util.IdGenerator;
import com.emergency.common.util.SecurityUtils;
import com.emergency.inventory.dto.AllocationRouteResult;
import com.emergency.inventory.dto.StockLockRequest;
import com.emergency.inventory.entity.*;
import com.emergency.inventory.mapper.*;
import com.emergency.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final WarehouseMapper warehouseMapper;
    private final MaterialMapper materialMapper;
    private final InventoryStockMapper inventoryStockMapper;
    private final StockLockMapper stockLockMapper;
    private final MaterialAllocationMapper allocationMapper;
    private final RedissonClient redissonClient;

    @Override
    public AllocationRouteResult calculateOptimalRoute(StockLockRequest request) {
        List<AllocationRouteResult.AllocationRouteItem> routes = new ArrayList<>();
        List<String> unavailable = new ArrayList<>();
        BigDecimal totalDistance = BigDecimal.ZERO;
        int totalDuration = 0;
        BigDecimal totalCost = BigDecimal.ZERO;

        for (StockLockRequest.StockLockItem item : request.getItems()) {
            List<InventoryStock> stocks = getAvailableStockNearby(
                    item.getMaterialId(), item.getQuantity(),
                    request.getLng(), request.getLat(),
                    request.getRadius().doubleValue(), 10);

            if (stocks.isEmpty()) {
                unavailable.add(item.getMaterialCode() != null ? item.getMaterialCode() : "物资ID:" + item.getMaterialId());
                continue;
            }

            int remaining = item.getQuantity();
            for (InventoryStock stock : stocks) {
                if (remaining <= 0) break;

                Warehouse warehouse = warehouseMapper.selectById(stock.getWarehouseId());
                int allocateQty = Math.min(remaining, stock.getAvailableQuantity());
                double distance = warehouse.getLocationPoint() != null
                        ? warehouse.getLocationPoint().distanceTo(new GeoPoint(request.getLng(), request.getLat()))
                        : 50;
                int duration = (int) (distance / 60 * 60);
                BigDecimal cost = BigDecimal.valueOf(distance * 5);

                Material material = materialMapper.selectById(item.getMaterialId());
                AllocationRouteResult.AllocationRouteItem routeItem =
                        AllocationRouteResult.AllocationRouteItem.builder()
                                .warehouseId(warehouse.getId())
                                .warehouseName(warehouse.getWarehouseName())
                                .materialId(material.getId())
                                .materialName(material.getMaterialName())
                                .allocatedQuantity(allocateQty)
                                .distance(BigDecimal.valueOf(distance))
                                .duration(duration)
                                .cost(cost.multiply(BigDecimal.valueOf(allocateQty)))
                                .suggestedRoute(String.format("经%s高速直达，预计%d分钟",
                                        distance > 100 ? "京港澳" : "地方道路", duration))
                                .build();

                routes.add(routeItem);
                totalDistance = totalDistance.add(BigDecimal.valueOf(distance));
                totalDuration = Math.max(totalDuration, duration);
                totalCost = totalCost.add(routeItem.getCost());
                remaining -= allocateQty;
            }

            if (remaining > 0) {
                unavailable.add(String.format("物资ID:%s 缺口%d件", item.getMaterialId(), remaining));
            }
        }

        return AllocationRouteResult.builder()
                .allocationNo(IdGenerator.generateInventoryNo())
                .feasible(unavailable.isEmpty())
                .totalDistance(totalDistance)
                .estimatedDuration(totalDuration)
                .totalCost(totalCost)
                .routes(routes)
                .unavailableMaterials(unavailable)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<Long> lockStocks(StockLockRequest request) {
        LoginUser currentUser = SecurityUtils.getCurrentUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        AllocationRouteResult routeResult = calculateOptimalRoute(request);
        if (!routeResult.isFeasible()) {
            throw new BusinessException(ResultCode.INVENTORY_INSUFFICIENT,
                    "物资不足: " + String.join("; ", routeResult.getUnavailableMaterials()));
        }

        List<Long> lockIds = new ArrayList<>();
        LocalDateTime expireAt = LocalDateTime.now().plusMinutes(request.getLockMinutes());

        Map<Long, Integer> warehouseMaterialQty = new HashMap<>();
        for (AllocationRouteResult.AllocationRouteItem route : routeResult.getRoutes()) {
            String key = route.getWarehouseId() + "_" + route.getMaterialId();
            warehouseMaterialQty.merge(key, route.getAllocatedQuantity(), Integer::sum);
        }

        for (Map.Entry<String, Integer> entry : warehouseMaterialQty.entrySet()) {
            String[] parts = entry.getKey().split("_");
            Long warehouseId = Long.parseLong(parts[0]);
            Long materialId = Long.parseLong(parts[1]);
            Integer quantity = entry.getValue();

            String lockKey = "inventory:stock:" + warehouseId + ":" + materialId;
            RLock lock = redissonClient.getLock(lockKey);
            try {
                if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                    throw new BusinessException("物资正在被锁定，请稍后再试");
                }
                try {
                    InventoryStock stock = inventoryStockMapper.selectByWarehouseAndMaterialForUpdate(warehouseId, materialId);
                    if (stock == null || stock.getAvailableQuantity() < quantity) {
                        throw new BusinessException(ResultCode.INVENTORY_INSUFFICIENT);
                    }

                    int updated = inventoryStockMapper.lockStock(stock.getId(), quantity, currentUser.getUserId());
                    if (updated == 0) {
                        throw new BusinessException(ResultCode.INVENTORY_INSUFFICIENT);
                    }

                    Material material = materialMapper.selectById(materialId);
                    StockLock stockLock = new StockLock();
                    stockLock.setLockNo(IdGenerator.generateInventoryNo());
                    stockLock.setIncidentId(request.getIncidentId());
                    stockLock.setDispatchPlanId(request.getDispatchPlanId());
                    stockLock.setWarehouseId(warehouseId);
                    stockLock.setMaterialId(materialId);
                    stockLock.setLockQuantity(quantity);
                    stockLock.setEstimatedCost(material.getUnitPrice().multiply(BigDecimal.valueOf(quantity)));
                    stockLock.setLockExpireAt(expireAt);
                    stockLock.setStatus(1);
                    stockLock.setLockReason(request.getReason());
                    stockLockMapper.insert(stockLock);
                    lockIds.add(stockLock.getId());

                    createAllocation(stockLock, routeResult, currentUser.getUserId());

                    log.info("物资锁定成功: lockId={}, warehouseId={}, materialId={}, quantity={}",
                            stockLock.getId(), warehouseId, materialId, quantity);
                } finally {
                    lock.unlock();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new BusinessException("系统异常");
            }
        }
        return lockIds;
    }

    private void createAllocation(StockLock lock, AllocationRouteResult routeResult, Long userId) {
        for (AllocationRouteResult.AllocationRouteItem route : routeResult.getRoutes()) {
            if (route.getWarehouseId().equals(lock.getWarehouseId())
                    && route.getMaterialId().equals(lock.getMaterialId())) {
                MaterialAllocation allocation = new MaterialAllocation();
                allocation.setAllocationNo(IdGenerator.generateInventoryNo());
                allocation.setIncidentId(lock.getIncidentId());
                allocation.setDispatchPlanId(lock.getDispatchPlanId());
                allocation.setFromWarehouseId(lock.getWarehouseId());
                allocation.setMaterialId(lock.getMaterialId());
                allocation.setQuantity(lock.getLockQuantity());
                allocation.setEstimatedDistance(route.getDistance());
                allocation.setEstimatedDuration(route.getDuration());
                allocation.setRoutePlan(route.getSuggestedRoute());
                allocation.setStatus(0);
                allocationMapper.insert(allocation);
                break;
            }
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean unlockStock(Long lockId, String reason) {
        StockLock lock = stockLockMapper.selectById(lockId);
        if (lock == null) {
            throw new BusinessException("锁定记录不存在");
        }
        if (lock.getStatus() != 1) {
            throw new BusinessException("锁定状态不可解锁");
        }

        Long userId = SecurityUtils.getCurrentUserId();
        inventoryStockMapper.unlockStock(
                inventoryStockMapper.selectByWarehouseAndMaterialForUpdate(
                        lock.getWarehouseId(), lock.getMaterialId()).getId(),
                lock.getLockQuantity(), userId);

        lock.setStatus(0);
        lock.setUnlockReason(reason);
        lock.setUnlockedAt(LocalDateTime.now());
        stockLockMapper.updateById(lock);

        log.info("物资解锁成功: lockId={}, reason={}", lockId, reason);
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean confirmAllocation(Long lockId) {
        StockLock lock = stockLockMapper.selectById(lockId);
        if (lock == null || lock.getStatus() != 1) {
            throw new BusinessException("锁定记录不存在或状态无效");
        }

        Long userId = SecurityUtils.getCurrentUserId();
        InventoryStock stock = inventoryStockMapper.selectByWarehouseAndMaterialForUpdate(
                lock.getWarehouseId(), lock.getMaterialId());
        inventoryStockMapper.deductStock(stock.getId(), lock.getLockQuantity(), LocalDateTime.now(), userId);

        lock.setStatus(2);
        stockLockMapper.updateById(lock);

        List<MaterialAllocation> allocations = allocationMapper.selectByLockId(lockId);
        for (MaterialAllocation allocation : allocations) {
            allocation.setStatus(2);
            allocation.setDepartedAt(LocalDateTime.now());
            allocationMapper.updateById(allocation);
        }

        log.info("物资调拨确认: lockId={}, materialId={}, quantity={}",
                lockId, lock.getMaterialId(), lock.getLockQuantity());
        return true;
    }

    @Override
    public Warehouse getWarehouseById(Long id) {
        return warehouseMapper.selectById(id);
    }

    @Override
    public List<Warehouse> getNearbyWarehouses(Double lng, Double lat, Double radius, Integer limit) {
        return warehouseMapper.selectNearbyWarehouses(lng, lat, radius, limit);
    }

    @Override
    public Material getMaterialById(Long id) {
        return materialMapper.selectById(id);
    }

    @Override
    public List<Material> getAllMaterials() {
        return materialMapper.selectList(null);
    }

    @Override
    public InventoryStock getStockById(Long id) {
        return inventoryStockMapper.selectById(id);
    }

    @Override
    public List<InventoryStock> getStockByWarehouseId(Long warehouseId) {
        return inventoryStockMapper.selectByWarehouseId(warehouseId);
    }

    @Override
    public List<InventoryStock> getStockByMaterialId(Long materialId) {
        return inventoryStockMapper.selectByMaterialId(materialId);
    }

    @Override
    public List<InventoryStock> getAvailableStockNearby(Long materialId, Integer quantity,
            Double lng, Double lat, Double radius, Integer limit) {
        return inventoryStockMapper.findAvailableStockNearby(materialId, quantity, lng, lat, radius, limit);
    }

    @Override
    public List<StockLock> getLocksByIncidentId(Long incidentId) {
        return stockLockMapper.selectByIncidentId(incidentId);
    }

    @Override
    public StockLock getLockById(Long id) {
        return stockLockMapper.selectById(id);
    }

    @Override
    public List<MaterialAllocation> getAllocationsByIncidentId(Long incidentId) {
        return allocationMapper.selectByIncidentId(incidentId);
    }

    @Override
    public MaterialAllocation getAllocationById(Long id) {
        return allocationMapper.selectById(id);
    }

    @Override
    public MaterialAllocation updateAllocationStatus(Long id, Integer status) {
        MaterialAllocation allocation = allocationMapper.selectById(id);
        if (allocation == null) {
            throw new BusinessException("调拨单不存在");
        }
        allocation.setStatus(status);
        if (status == 3) {
            allocation.setArrivedAt(LocalDateTime.now());
        }
        allocationMapper.updateById(allocation);
        return allocation;
    }

    @Override
    public List<Warehouse> getAllWarehouses() {
        return warehouseMapper.selectList(null);
    }
}
