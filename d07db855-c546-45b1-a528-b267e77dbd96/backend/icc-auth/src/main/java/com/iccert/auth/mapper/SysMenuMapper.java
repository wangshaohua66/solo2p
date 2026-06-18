package com.iccert.auth.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iccert.auth.entity.SysMenu;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysMenuMapper extends BaseMapper<SysMenu> {

    @Select("SELECT DISTINCT m.* FROM sys_menu m " +
            "INNER JOIN sys_role_menu rm ON m.id = rm.menu_id " +
            "INNER JOIN sys_user_role ur ON rm.role_id = ur.role_id " +
            "WHERE ur.user_id = #{userId} AND m.menu_type IN (1,2) " +
            "AND m.visible = 1 AND m.status = 1 AND m.is_deleted = 0 " +
            "ORDER BY m.parent_id, m.sort")
    List<SysMenu> selectMenusByUserId(@Param("userId") Long userId);

    @Select("SELECT m.* FROM sys_menu m WHERE m.menu_type IN (1,2) " +
            "AND m.visible = 1 AND m.status = 1 AND m.is_deleted = 0 " +
            "ORDER BY m.parent_id, m.sort")
    List<SysMenu> selectAllMenus();
}
