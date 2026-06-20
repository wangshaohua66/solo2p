package com.mw.common.audit;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum AuditAction {

    CREATE("新增"),
    UPDATE("修改"),
    DELETE("删除"),
    QUERY("查询"),
    LOGIN("登录"),
    LOGOUT("登出"),
    VOID("作废"),
    AMEND("变更"),
    DISPATCH("派单"),
    CONFIRM("确认"),
    EXPORT("导出"),
    UPLOAD("上传"),
    OTHER("其他");

    private final String desc;
}
