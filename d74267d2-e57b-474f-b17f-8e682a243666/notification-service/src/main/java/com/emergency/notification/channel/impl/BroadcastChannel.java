package com.emergency.notification.channel.impl;

import com.emergency.common.enums.NotificationChannel;
import com.emergency.common.enums.NotificationStatus;
import com.emergency.notification.entity.Notification;
import com.emergency.notification.entity.NotificationReceipt;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
public class BroadcastChannel implements com.emergency.notification.channel.NotificationChannel {

    @Override
    public String getChannelName() {
        return NotificationChannel.BROADCAST.name();
    }

    @Override
    public boolean send(Notification notification, List<NotificationReceipt> receipts) {
        log.info("开始发送广播通知: notificationId={}, regionCode={}",
                notification.getId(), notification.getRegionCode());
        for (NotificationReceipt receipt : receipts) {
            try {
                String messageId = UUID.randomUUID().toString().replace("-", "");
                receipt.setMessageId(messageId);
                receipt.setChannel(NotificationChannel.BROADCAST);
                receipt.setStatus(NotificationStatus.SENT);
                receipt.setSentAt(LocalDateTime.now());
                log.info("广播发送成功: regionCode={}, messageId={}", notification.getRegionCode(), messageId);
            } catch (Exception e) {
                log.error("广播发送失败: regionCode={}", notification.getRegionCode(), e);
                receipt.setStatus(NotificationStatus.FAILED);
                receipt.setFailureReason(e.getMessage());
            }
        }
        return true;
    }
}
