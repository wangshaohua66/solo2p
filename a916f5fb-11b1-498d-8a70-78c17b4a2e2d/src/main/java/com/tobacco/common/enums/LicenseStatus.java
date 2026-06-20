package com.tobacco.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum LicenseStatus {

    PENDING_FIRST_REVIEW(0, "待初审", "pending_first_review"),
    PENDING_SECOND_REVIEW(1, "待复审", "pending_second_review"),
    PENDING_FINAL_REVIEW(2, "待终审", "pending_final_review"),
    APPROVED(10, "审批通过-正常营业", "approved"),
    REJECTED(11, "审批驳回", "rejected"),
    SUSPENDED(20, "停业", "suspended"),
    PENDING_RENEWAL(21, "待延续", "pending_renewal"),
    RENEWING(22, "延续审批中", "renewing"),
    CHANGING(23, "变更审批中", "changing"),
    CANCELLED(30, "注销", "cancelled"),
    EXPIRED(31, "过期", "expired");

    private final Integer code;
    private final String name;
    private final String value;

    public static LicenseStatus getByCode(Integer code) {
        if (code == null) return null;
        for (LicenseStatus status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        return null;
    }
}
