package com.emergency.auth.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.auth.entity.Role;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RoleMapper extends BaseMapper<Role> {

    @Select("SELECT * FROM sys_role WHERE code = #{code} AND deleted = 0")
    Role selectByCode(@Param("code") String code);

    @Select("SELECT r.* FROM sys_role r " +
            "INNER JOIN sys_user_role ur ON r.id = ur.role_id " +
            "WHERE ur.user_id = #{userId} AND r.deleted = 0 AND ur.deleted = 0 " +
            "ORDER BY r.sort_order")
    List<Role> selectByUserId(@Param("userId") Long userId);
}
