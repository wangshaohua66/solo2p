package com.iccert.task.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.iccert.task.entity.Notification;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface NotificationMapper extends BaseMapper<Notification> {

    @Select("SELECT * FROM sys_notification WHERE target_user_id = #{userId} AND is_read = 0 ORDER BY create_time DESC")
    List<Notification> selectUnreadByUser(@Param("userId") Long userId);

    @Select("SELECT * FROM sys_notification WHERE target_role_code = #{roleCode} AND is_read = 0 ORDER BY create_time DESC")
    List<Notification> selectUnreadByRole(@Param("roleCode") String roleCode);
}
