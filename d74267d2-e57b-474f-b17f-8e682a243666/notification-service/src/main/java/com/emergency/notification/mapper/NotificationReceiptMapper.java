package com.emergency.notification.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.emergency.notification.entity.NotificationReceipt;
import com.emergency.notification.entity.NotificationTemplate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface NotificationReceiptMapper extends BaseMapper<NotificationReceipt> {

    @Select("SELECT * FROM notification_receipt WHERE notification_id = #{notificationId} AND deleted = 0 ORDER BY created_at")
    List<NotificationReceipt> selectByNotificationId(@Param("notificationId") Long notificationId);

    @Select("SELECT * FROM notification_receipt WHERE recipient_id = #{recipientId} AND deleted = 0 ORDER BY created_at DESC LIMIT 100")
    List<NotificationReceipt> selectByRecipientId(@Param("recipientId") Long recipientId);

    @Select("SELECT * FROM notification_template WHERE template_code = #{templateCode} AND deleted = 0")
    NotificationTemplate selectByTemplateCode(@Param("templateCode") String templateCode);
}
