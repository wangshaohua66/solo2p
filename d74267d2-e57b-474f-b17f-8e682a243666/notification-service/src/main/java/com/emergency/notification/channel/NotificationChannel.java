package com.emergency.notification.channel;

import com.emergency.notification.entity.Notification;
import com.emergency.notification.entity.NotificationReceipt;

import java.util.List;

public interface NotificationChannel {

    String getChannelName();

    boolean send(Notification notification, List<NotificationReceipt> receipts);
}
