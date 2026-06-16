package com.emergency.inventory.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.inventory.entity.Warehouse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface WarehouseMapper extends BaseMapper<Warehouse> {

    @Select("SELECT * FROM warehouse WHERE deleted = 0 " +
            "AND ST_DWithin(location_point::geography, ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326)::geography, #{radius} * 1000) " +
            "ORDER BY ST_Distance(location_point::geography, ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326)::geography) " +
            "LIMIT #{limit}")
    List<Warehouse> selectNearbyWarehouses(
            @Param("lng") Double lng,
            @Param("lat") Double lat,
            @Param("radius") Double radius,
            @Param("limit") Integer limit);
}
