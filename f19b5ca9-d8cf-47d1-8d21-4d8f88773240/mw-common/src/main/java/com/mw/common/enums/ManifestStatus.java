package com.mw.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ManifestStatus {

    DRAFT("草稿"),
    VALID("有效"),
    COMPLETED("已完结"),
    VOID("已作废"),
    AMENDED("已变更");

    private final String desc;
}
