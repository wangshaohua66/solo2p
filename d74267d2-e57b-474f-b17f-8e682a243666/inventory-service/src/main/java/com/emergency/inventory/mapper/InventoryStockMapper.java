package com.emergency.inventory.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.inventory.entity.InventoryStock;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface InventoryStockMapper extends BaseMapper<InventoryStock> {

    @Select("SELECT s.* FROM inventory_stock s " +
            "INNER JOIN warehouse w ON s.warehouse_id = w.id " +
            "WHERE s.material_id = #{materialId} AND s.available_quantity >= #{quantity} " +
            "AND s.deleted = 0 AND w.deleted = 0 " +
            "AND ST_DWithin(w.location_point::geography, ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326)::geography, #{radius} * 1000) " +
            "ORDER BY ST_Distance(w.location_point::geography, ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326)::geography) " +
            "LIMIT #{limit}")
    List<InventoryStock> findAvailableStockNearby(
            @Param("materialId") Long materialId,
            @Param("quantity") Integer quantity,
            @Param("lng") Double lng,
            @Param("lat") Double lat,
            @Param("radius") Double radius,
            @Param("limit") Integer limit);

    @Update("UPDATE inventory_stock SET " +
            "locked_quantity = locked_quantity + #{lockQuantity}, " +
            "available_quantity = available_quantity - #{lockQuantity}, " +
            "updated_by = #{userId}, updated_at = NOW() " +
            "WHERE id = #{id} AND available_quantity >= #{lockQuantity}")
    int lockStock(@Param("id") Long id, @Param("lockQuantity") Integer lockQuantity, @Param("userId") Long userId);

    @Update("UPDATE inventory_stock SET " +
            "locked_quantity = locked_quantity - #{unlockQuantity}, " +
            "available_quantity = available_quantity + #{unlockQuantity}, " +
            "updated_by = #{userId}, updated_at = NOW() " +
            "WHERE id = #{id} AND locked_quantity >= #{unlockQuantity}")
    int unlockStock(@Param("id") Long id, @Param("unlockQuantity") Integer unlockQuantity, @Param("userId") Long userId);

    @Update("UPDATE inventory_stock SET " +
            "locked_quantity = locked_quantity - #{quantity}, " +
            "quantity = quantity - #{quantity}, " +
            "last_outbound_at = #{now}, " +
            "updated_by = #{userId}, updated_at = NOW() " +
            "WHERE id = #{id} AND locked_quantity >= #{quantity}")
    int deductStock(@Param("id") Long id, @Param("quantity") Integer quantity,
                    @Param("now") LocalDateTime now, @Param("userId") Long userId);

    @Select("SELECT * FROM inventory_stock WHERE warehouse_id = #{warehouseId} AND material_id = #{materialId} AND deleted = 0 FOR UPDATE")
    InventoryStock selectByWarehouseAndMaterialForUpdate(
            @Param("warehouseId") Long warehouseId,
            @Param("materialId") Long materialId);
}
