package com.emergency.inventory.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.inventory.entity.InventoryStock;
import com.emergency.inventory.entity.StockLock;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface StockLockMapper extends BaseMapper<StockLock> {

    @Select("SELECT * FROM stock_lock WHERE incident_id = #{incidentId} AND deleted = 0 ORDER BY created_at DESC")
    List<StockLock> selectByIncidentId(@Param("incidentId") Long incidentId);

    @Select("SELECT * FROM inventory_stock WHERE warehouse_id = #{warehouseId} AND deleted = 0 ORDER BY material_code")
    List<InventoryStock> selectByWarehouseId(@Param("warehouseId") Long warehouseId);

    @Select("SELECT * FROM inventory_stock WHERE material_id = #{materialId} AND deleted = 0 ORDER BY warehouse_id")
    List<InventoryStock> selectByMaterialId(@Param("materialId") Long materialId);
}
