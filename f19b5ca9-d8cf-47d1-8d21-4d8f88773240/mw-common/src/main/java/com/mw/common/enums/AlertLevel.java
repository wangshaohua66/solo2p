package com.mw.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum AlertLevel {

    INFO("提示", 1),
    WARNING("警告", 2),
    URGENT("紧急", 3);

    private final String desc;
    private final int priority;
}
