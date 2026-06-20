package com.mw.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum WasteStatus {

    REGISTERED("已登记"),
    PENDING_TRANSFER("待收运"),
    TRANSFERRING("运输中"),
    RECEIVED("已到达处置中心"),
    DISPOSING("处置中"),
    DISPOSED("已处置"),
    VOID("已作废");

    private final String desc;
}
