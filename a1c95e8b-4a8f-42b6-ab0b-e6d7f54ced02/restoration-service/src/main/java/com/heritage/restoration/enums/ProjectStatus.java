package com.heritage.restoration.enums;

import lombok.Getter;

@Getter
public enum ProjectStatus {
    DRAFT("草稿"),
    APPROVING("审批中"),
    APPROVED("已立项"),
    IN_PROGRESS("进行中"),
    PAUSED("已暂停"),
    COMPLETED("已完成"),
    ACCEPTED("已验收"),
    CANCELLED("已取消");

    private final String label;
    ProjectStatus(String label) { this.label = label; }
}
