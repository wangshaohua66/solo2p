package com.emergency.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ApprovalStatus {

    PENDING("待审批", 0),
    APPROVED("已通过", 1),
    REJECTED("已拒绝", 2);

    private final String description;
    private final int code;

    public static ApprovalStatus fromCode(int code) {
        for (ApprovalStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        return PENDING;
    }
}
