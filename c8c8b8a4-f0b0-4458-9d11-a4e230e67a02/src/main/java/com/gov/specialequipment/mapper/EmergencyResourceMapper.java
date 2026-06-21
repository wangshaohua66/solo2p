package com.gov.specialequipment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.gov.specialequipment.entity.EmergencyResource;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface EmergencyResourceMapper extends BaseMapper<EmergencyResource> {

    @Select("SELECT * FROM emergency_resource WHERE deleted = 0 AND region_code = #{regionCode} AND status = 1 ORDER BY resource_type")
    List<EmergencyResource> selectByRegion(@Param("regionCode") String regionCode);
}
