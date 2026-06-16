package com.emergency.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum TeamStatus {

    AVAILABLE("待命", 1),
    DISPATCHED("已派出", 2),
    ON_SCENE("已到达", 3),
    WORKING("作业中", 4),
    RETURNING("返程中", 5),
    MAINTENANCE("维护中", 6),
    RESTING("休整中", 7);

    private final String description;
    private final int code;

    public static TeamStatus fromCode(int code) {
        for (TeamStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        return MAINTENANCE;
    }

    public boolean isAvailable() {
        return this == AVAILABLE;
    }
}
