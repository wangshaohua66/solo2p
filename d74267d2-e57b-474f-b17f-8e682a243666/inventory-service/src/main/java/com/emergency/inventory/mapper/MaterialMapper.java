package com.emergency.inventory.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.inventory.entity.Material;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MaterialMapper extends BaseMapper<Material> {

    @Select("SELECT * FROM material WHERE material_code = #{code} AND deleted = 0")
    Material selectByCode(@Param("code") String code);
}
