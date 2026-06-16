package com.emergency.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum NotificationChannel {

    SMS("短信", 1),
    APP_PUSH("App推送", 2),
    BROADCAST("广播", 3),
    EMAIL("邮件", 4),
    VOICE("语音电话", 5);

    private final String description;
    private final int code;

    public static NotificationChannel fromCode(int code) {
        for (NotificationChannel channel : values()) {
            if (channel.code == code) {
                return channel;
            }
        }
        return SMS;
    }
}
