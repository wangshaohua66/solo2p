package com.emergency.inventory.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.inventory.entity.MaterialAllocation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MaterialAllocationMapper extends BaseMapper<MaterialAllocation> {

    @Select("SELECT * FROM material_allocation WHERE incident_id = #{incidentId} AND deleted = 0 ORDER BY created_at DESC")
    List<MaterialAllocation> selectByIncidentId(@Param("incidentId") Long incidentId);

    @Select("SELECT a.* FROM material_allocation a " +
            "INNER JOIN stock_lock l ON a.incident_id = l.incident_id " +
            "WHERE l.id = #{lockId} AND a.deleted = 0 AND l.deleted = 0")
    List<MaterialAllocation> selectByLockId(@Param("lockId") Long lockId);
}
