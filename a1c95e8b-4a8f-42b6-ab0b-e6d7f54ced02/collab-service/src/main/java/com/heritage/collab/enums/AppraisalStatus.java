package com.heritage.collab.enums;

import lombok.Getter;

@Getter
public enum AppraisalStatus {
    DRAFT("DRAFT", "草稿"),
    INVITING("INVITING", "邀请专家"),
    IN_PROGRESS("IN_PROGRESS", "鉴定中"),
    COMPLETED("COMPLETED", "已完成"),
    CANCELLED("CANCELLED", "已取消");

    private final String code;
    private final String name;

    AppraisalStatus(String code, String name) {
        this.code = code;
        this.name = name;
    }
}
