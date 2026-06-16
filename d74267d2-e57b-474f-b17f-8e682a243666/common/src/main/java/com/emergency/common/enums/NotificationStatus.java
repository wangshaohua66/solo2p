package com.emergency.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum NotificationStatus {

    PENDING("待发送", 0),
    SENT("已发送", 1),
    DELIVERED("已送达", 2),
    READ("已读", 3),
    FAILED("发送失败", 4),
    EXPIRED("已过期", 5);

    private final String description;
    private final int code;

    public static NotificationStatus fromCode(int code) {
        for (NotificationStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        return PENDING;
    }
}
