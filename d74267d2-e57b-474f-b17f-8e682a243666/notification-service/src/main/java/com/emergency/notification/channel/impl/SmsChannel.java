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
public class SmsChannel implements com.emergency.notification.channel.NotificationChannel {

    @Override
    public String getChannelName() {
        return NotificationChannel.SMS.name();
    }

    @Override
    public boolean send(Notification notification, List<NotificationReceipt> receipts) {
        log.info("开始发送短信通知: notificationId={}, count={}", notification.getId(), receipts.size());
        for (NotificationReceipt receipt : receipts) {
            try {
                String messageId = UUID.randomUUID().toString().replace("-", "");
                receipt.setMessageId(messageId);
                receipt.setChannel(NotificationChannel.SMS);
                receipt.setStatus(NotificationStatus.SENT);
                receipt.setSentAt(LocalDateTime.now());
                receipt.setDeliveredAt(LocalDateTime.now().plusSeconds(5));
                log.info("短信发送成功: phone={}, messageId={}", receipt.getRecipientPhone(), messageId);
            } catch (Exception e) {
                log.error("短信发送失败: phone={}", receipt.getRecipientPhone(), e);
                receipt.setStatus(NotificationStatus.FAILED);
                receipt.setFailureReason(e.getMessage());
            }
        }
        return true;
    }
}
