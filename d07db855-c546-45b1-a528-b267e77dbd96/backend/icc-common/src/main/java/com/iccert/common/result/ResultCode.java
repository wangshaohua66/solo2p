package com.iccert.common.result;

import lombok.Getter;

@Getter
public enum ResultCode {

    SUCCESS(200, "操作成功"),
    FAIL(500, "操作失败"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未登录或token已过期"),
    FORBIDDEN(403, "没有访问权限"),
    NOT_FOUND(404, "请求资源不存在"),
    METHOD_NOT_ALLOWED(405, "请求方法不支持"),

    LOGIN_ERROR(1001, "用户名或密码错误"),
    USER_DISABLED(1002, "账号已被禁用"),
    TOKEN_INVALID(1003, "Token无效"),
    TOKEN_EXPIRED(1004, "Token已过期"),

    SAMPLE_NOT_FOUND(2001, "样品不存在"),
    SAMPLE_STATUS_ERROR(2002, "样品状态异常"),
    RETENTION_EXPIRED(2003, "留样已到期待销毁"),

    TASK_NOT_FOUND(3001, "任务不存在"),
    TASK_DISPATCH_FAIL(3002, "任务调度失败"),
    EQUIPMENT_CONFLICT(3003, "设备预约时间冲突"),
    EQUIPMENT_BUSY(3004, "设备当前繁忙"),

    REPORT_NOT_FOUND(4001, "报告不存在"),
    REPORT_STATUS_ERROR(4002, "报告状态异常"),
    CERT_NOT_FOUND(4003, "证书不存在"),
    CERT_REVOKED(4004, "证书已被撤销"),
    CERT_EXPIRING(4005, "证书即将到期"),

    APPLICATION_NOT_FOUND(5001, "申请单不存在"),
    PAYMENT_AMOUNT_ERROR(5002, "支付金额错误"),

    DATA_TAMPERED(6001, "检测原始记录数据完整性校验失败，疑似被篡改");

    private final Integer code;
    private final String message;

    ResultCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
}
