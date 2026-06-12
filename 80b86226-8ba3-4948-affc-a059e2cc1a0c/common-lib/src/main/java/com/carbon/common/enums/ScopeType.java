package com.carbon.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ScopeType {

    SCOPE_1("SCOPE_1", "直接排放 - Scope 1"),
    SCOPE_2("SCOPE_2", "间接能源排放 - Scope 2"),
    SCOPE_3("SCOPE_3", "其他间接排放 - Scope 3");

    private final String code;
    private final String description;
}
