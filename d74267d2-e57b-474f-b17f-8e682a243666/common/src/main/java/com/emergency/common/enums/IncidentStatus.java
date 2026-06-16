package com.emergency.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum IncidentStatus {

    PENDING("待核实", 0),
    VERIFIED("已核实", 1),
    RESPONDING("响应中", 2),
    DISPATCHED("已调度", 3),
    HANDLING("处置中", 4),
    CONTROLLED("已控制", 5),
    CLOSED("已结案", 6),
    CANCELLED("已取消", 7);

    private final String description;
    private final int code;

    public static IncidentStatus fromCode(int code) {
        for (IncidentStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        return PENDING;
    }

    public boolean canTransitionTo(IncidentStatus newStatus) {
        return switch (this) {
            case PENDING -> newStatus == VERIFIED || newStatus == CANCELLED;
            case VERIFIED -> newStatus == RESPONDING || newStatus == CANCELLED;
            case RESPONDING -> newStatus == DISPATCHED;
            case DISPATCHED -> newStatus == HANDLING;
            case HANDLING -> newStatus == CONTROLLED;
            case CONTROLLED -> newStatus == CLOSED;
            default -> false;
        };
    }
}
