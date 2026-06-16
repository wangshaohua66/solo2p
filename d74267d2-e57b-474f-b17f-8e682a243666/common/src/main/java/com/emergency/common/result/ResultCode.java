package com.emergency.common.result;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ResultCode {

    SUCCESS(200, "操作成功"),
    ERROR(500, "系统错误"),

    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未授权，请登录"),
    FORBIDDEN(403, "权限不足"),
    NOT_FOUND(404, "资源不存在"),

    INCIDENT_NOT_FOUND(1001, "灾情事件不存在"),
    INCIDENT_ALREADY_CLOSED(1002, "灾情事件已关闭"),
    INCIDENT_LEVEL_INVALID(1003, "灾情等级无效"),

    DISPATCH_CONFLICT(2001, "调度冲突，队伍已被派遣"),
    DISPATCH_NOT_FOUND(2002, "调度方案不存在"),
    TEAM_NOT_AVAILABLE(2003, "救援队伍不可用"),

    INVENTORY_INSUFFICIENT(3001, "库存不足"),
    WAREHOUSE_NOT_FOUND(3002, "仓库不存在"),
    MATERIAL_NOT_FOUND(3003, "物资不存在"),
    LOCK_EXPIRED(3004, "物资锁定已过期"),

    NOTIFICATION_FAILED(4001, "通知发送失败"),
    NOTIFICATION_NOT_FOUND(4002, "通知不存在"),

    AUTH_FAILED(5001, "用户名或密码错误"),
    TOKEN_EXPIRED(5002, "令牌已过期"),
    TOKEN_INVALID(5003, "令牌无效"),
    USER_DISABLED(5004, "用户已被禁用"),

    DATA_PERMISSION_DENIED(6001, "无此数据权限"),
    APPROVAL_REQUIRED(6002, "需要上级审批"),
    APPROVAL_NOT_FOUND(6003, "审批记录不存在"),

    GATEWAY_TIMEOUT(7001, "网关超时"),
    SERVICE_UNAVAILABLE(7002, "服务不可用"),
    RATE_LIMITED(7003, "请求过于频繁，请稍后再试");

    private final Integer code;
    private final String message;
}
