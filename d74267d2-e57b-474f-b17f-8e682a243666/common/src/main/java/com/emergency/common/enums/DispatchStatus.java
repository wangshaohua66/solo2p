package com.emergency.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum DispatchStatus {

    DRAFT("草稿", 0),
    PENDING_APPROVAL("待审批", 1),
    APPROVED("已批准", 2),
    DISPATCHED("已派出", 3),
    IN_PROGRESS("执行中", 4),
    COMPLETED("已完成", 5),
    REJECTED("已拒绝", 6),
    CANCELLED("已取消", 7);

    private final String description;
    private final int code;

    public static DispatchStatus fromCode(int code) {
        for (DispatchStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        return DRAFT;
    }
}
