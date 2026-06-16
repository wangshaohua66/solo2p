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
public class AppPushChannel implements com.emergency.notification.channel.NotificationChannel {

    @Override
    public String getChannelName() {
        return NotificationChannel.APP_PUSH.name();
    }

    @Override
    public boolean send(Notification notification, List<NotificationReceipt> receipts) {
        log.info("开始发送App推送通知: notificationId={}, count={}", notification.getId(), receipts.size());
        for (NotificationReceipt receipt : receipts) {
            try {
                String messageId = UUID.randomUUID().toString().replace("-", "");
                receipt.setMessageId(messageId);
                receipt.setChannel(NotificationChannel.APP_PUSH);
                receipt.setStatus(NotificationStatus.SENT);
                receipt.setSentAt(LocalDateTime.now());
                receipt.setDeliveredAt(LocalDateTime.now().plusSeconds(2));
                log.info("App推送成功: userId={}, messageId={}", receipt.getRecipientId(), messageId);
            } catch (Exception e) {
                log.error("App推送失败: userId={}", receipt.getRecipientId(), e);
                receipt.setStatus(NotificationStatus.FAILED);
                receipt.setFailureReason(e.getMessage());
            }
        }
        return true;
    }
}
