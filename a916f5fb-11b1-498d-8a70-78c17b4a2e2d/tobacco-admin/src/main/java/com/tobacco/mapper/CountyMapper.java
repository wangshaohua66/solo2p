package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tobacco.entity.County;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CountyMapper extends BaseMapper<County> {

    @Select("SELECT * FROM sys_county WHERE id = #{id} AND deleted = 0")
    County selectById(@Param("id") Long id);

    @Select("SELECT * FROM sys_county WHERE county_code = #{countyCode} AND deleted = 0")
    County selectByCode(@Param("countyCode") String countyCode);

    @Select("SELECT * FROM sys_county WHERE status = 1 AND deleted = 0 ORDER BY sort_order ASC")
    List<County> selectAllEnabled();
}
