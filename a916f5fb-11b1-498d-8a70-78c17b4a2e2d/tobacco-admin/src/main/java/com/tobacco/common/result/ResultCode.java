package com.tobacco.common.result;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ResultCode {

    SUCCESS(200, "操作成功"),
    FAIL(500, "操作失败"),
    PARAM_ERROR(400, "参数错误"),
    UNAUTHORIZED(401, "未认证"),
    FORBIDDEN(403, "无权限"),
    NOT_FOUND(404, "资源不存在"),

    LICENSE_NOT_FOUND(1001, "许可证不存在"),
    LICENSE_STATUS_ERROR(1002, "许可证状态错误"),
    LICENSE_DISTANCE_VIOLATION(1003, "经营场所间距不符合要求"),
    LICENSE_ALREADY_EXISTS(1004, "许可证已存在"),
    LICENSE_EXPIRED(1005, "许可证已过期"),

    ORDER_QUOTA_EXCEEDED(2001, "超出订货配额"),
    ORDER_STATUS_ERROR(2002, "订单状态错误"),
    ORDER_NOT_FOUND(2003, "订单不存在"),

    CREDIT_INSUFFICIENT(3001, "信用等级不足"),

    DELIVERY_PLAN_NOT_FOUND(4001, "配送计划不存在"),

    INSPECTION_TASK_NOT_FOUND(5001, "稽查任务不存在"),
    INSPECTION_RECORD_NOT_FOUND(5002, "稽查记录不存在"),

    USER_NOT_FOUND(6001, "用户不存在"),
    USER_PASSWORD_ERROR(6002, "密码错误"),
    USER_DISABLED(6003, "用户已禁用"),
    USERNAME_ALREADY_EXISTS(6004, "用户名已存在"),

    TOKEN_EXPIRED(7001, "令牌已过期"),
    TOKEN_INVALID(7002, "令牌无效"),
    TOKEN_REFRESH_FAILED(7003, "令牌刷新失败");

    private final Integer code;
    private final String message;
}
