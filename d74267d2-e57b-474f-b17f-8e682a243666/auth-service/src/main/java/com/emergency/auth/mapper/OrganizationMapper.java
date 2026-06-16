package com.emergency.auth.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.auth.entity.Organization;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface OrganizationMapper extends BaseMapper<Organization> {

    @Select("SELECT * FROM sys_organization WHERE parent_id = #{parentId} AND deleted = 0 ORDER BY sort_order")
    List<Organization> selectByParentId(@Param("parentId") Long parentId);

    @Select("SELECT * FROM sys_organization WHERE parent_path LIKE CONCAT(#{path}, '%') AND deleted = 0 ORDER BY level, sort_order")
    List<Organization> selectByParentPath(@Param("path") String path);

    @Select("SELECT id FROM sys_organization WHERE parent_path LIKE CONCAT(#{path}, '%') AND deleted = 0")
    List<Long> selectChildIds(@Param("path") String path);

    @Select("SELECT * FROM sys_organization WHERE code = #{code} AND deleted = 0")
    Organization selectByCode(@Param("code") String code);

    @Select("SELECT * FROM sys_organization WHERE region_code = #{regionCode} AND deleted = 0 LIMIT 1")
    Organization selectByRegionCode(@Param("regionCode") String regionCode);
}
