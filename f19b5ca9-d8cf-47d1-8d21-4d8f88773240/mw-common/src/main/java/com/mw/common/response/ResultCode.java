package com.mw.common.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ResultCode {

    SUCCESS(200, "操作成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未登录或登录已过期"),
    FORBIDDEN(403, "无操作权限"),
    NOT_FOUND(404, "资源不存在"),
    CONFLICT(409, "数据冲突"),
    TOO_MANY_REQUESTS(429, "请求过于频繁"),
    INTERNAL_ERROR(500, "系统内部错误"),

    ORG_NOT_QUALIFIED(10001, "机构资质校验失败"),
    OPERATOR_NO_PERMISSION(10002, "操作员无该机构操作权限"),
    WASTE_CATEGORY_INVALID(10003, "废物类别不合规"),
    MANIFEST_NOT_EXIST(10004, "电子联单不存在"),
    MANIFEST_STATUS_NOT_ALLOW(10005, "联单状态不允许当前操作"),
    TRACE_CODE_NOT_EXIST(10006, "追溯编码不存在"),
    VEHICLE_NOT_AVAILABLE(10007, "无可用运力"),
    DISPOSAL_NOT_QUALIFIED(10008, "处置不达标"),
    ALERT_RULE_NOT_EXIST(10009, "预警规则不存在");

    private final int code;
    private final String message;
}
