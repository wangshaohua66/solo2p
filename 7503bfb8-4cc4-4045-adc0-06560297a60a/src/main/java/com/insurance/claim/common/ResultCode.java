package com.insurance.claim.common;

import lombok.Getter;

@Getter
public enum ResultCode {

    SUCCESS(200, "操作成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未授权访问"),
    FORBIDDEN(403, "权限不足"),
    NOT_FOUND(404, "资源不存在"),
    INTERNAL_ERROR(500, "系统内部错误"),

    CLAIM_NOT_FOUND(1001, "理赔案件不存在"),
    CLAIM_STATUS_ERROR(1002, "理赔案件状态错误"),
    POLICY_NOT_FOUND(1003, "保单不存在"),
    POLICY_EXPIRED(1004, "保单已过期"),
    POLICY_INSUFFICIENT_COVERAGE(1005, "保额不足"),
    FRAUD_DETECTED(1006, "检测到欺诈风险"),
    PAYMENT_FAILED(1007, "支付失败"),
    DUPLICATE_CLAIM(1008, "重复报案"),
    VALIDATION_ERROR(1009, "参数校验失败"),
    LOGIN_FAILED(1010, "用户名或密码错误"),
    TOKEN_EXPIRED(1011, "令牌已过期"),
    TOKEN_INVALID(1012, "令牌无效"),
    USER_NOT_FOUND(1013, "用户不存在"),
    DATA_INTEGRITY_ERROR(1014, "数据完整性错误");

    private final Integer code;
    private final String message;

    ResultCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
}
