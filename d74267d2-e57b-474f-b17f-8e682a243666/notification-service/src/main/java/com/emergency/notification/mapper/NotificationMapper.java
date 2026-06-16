package com.emergency.notification.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.notification.entity.Notification;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface NotificationMapper extends BaseMapper<Notification> {

    @Select("SELECT * FROM notification WHERE incident_id = #{incidentId} AND deleted = 0 ORDER BY created_at DESC")
    List<Notification> selectByIncidentId(@Param("incidentId") Long incidentId);

    @Select("SELECT * FROM notification WHERE notification_no = #{notificationNo} AND deleted = 0")
    Notification selectByNotificationNo(@Param("notificationNo") String notificationNo);

    @Update("UPDATE notification SET status = #{status}, sent_at = #{sentAt}, updated_by = #{userId}, updated_at = NOW() WHERE id = #{id}")
    int updateStatus(@Param("id") Long id, @Param("status") Integer status,
                     @Param("sentAt") LocalDateTime sentAt, @Param("userId") Long userId);

    @Update("UPDATE notification SET success_count = success_count + 1, updated_by = #{userId}, updated_at = NOW() WHERE id = #{id}")
    int incrementSuccessCount(@Param("id") Long id, @Param("userId") Long userId);

    @Update("UPDATE notification SET fail_count = fail_count + 1, updated_by = #{userId}, updated_at = NOW() WHERE id = #{id}")
    int incrementFailCount(@Param("id") Long id, @Param("userId") Long userId);

    @Update("UPDATE notification SET read_count = read_count + 1, updated_by = #{userId}, updated_at = NOW() WHERE id = #{id}")
    int incrementReadCount(@Param("id") Long id, @Param("userId") Long userId);

    @Select("SELECT * FROM notification WHERE status = 0 AND deleted = 0 AND (scheduled_at IS NULL OR scheduled_at <= NOW()) ORDER BY priority, created_at LIMIT #{limit}")
    List<Notification> selectPendingNotifications(@Param("limit") Integer limit);
}
