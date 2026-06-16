package com.crew.common;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {

    CREW_NOT_FOUND(10001, "机组人员不存在"),
    CREW_ALREADY_EXISTS(10002, "机组人员已存在"),
    CREW_UNAVAILABLE(10003, "机组人员不可用"),
    CREW_IN_DUTY(10004, "机组人员正在执勤中，无法修改"),
    CREW_TYPE_INVALID(10005, "机组人员类型无效"),

    ROSTER_GENERATION_FAILED(20001, "排班生成失败"),
    ROSTER_NOT_FOUND(20002, "排班方案不存在"),
    ROSTER_ALREADY_APPROVED(20003, "排班方案已审批"),
    ROSTER_CONFLICT(20004, "排班冲突"),
    ROSTER_CONSTRAINT_VIOLATION(20005, "排班约束违规"),
    ROSTER_SWAP_NO_CANDIDATE(20006, "无合规替代人选"),
    ROSTER_GENERATION_TIMEOUT(20007, "排班生成超时"),

    FATIGUE_ALERT_TRIGGERED(30001, "疲劳预警已触发"),
    FATIGUE_SCORE_EXCEEDED(30002, "疲劳指数超标"),
    FATIGUE_DUTY_LOCKED(30003, "执勤已锁定"),
    FATIGUE_NOT_FOUND(30004, "疲劳记录不存在"),

    QUAL_EXPIRED(40001, "资质已过期"),
    QUAL_NOT_FOUND(40002, "资质记录不存在"),
    QUAL_TYPE_MISMATCH(40003, "机型资质不匹配"),
    QUAL_LICENSE_INVALID(40004, "执照无效"),
    QUAL_MEDICAL_EXPIRED(40005, "体检已过期"),

    AUTH_UNAUTHORIZED(40100, "未授权"),
    AUTH_FORBIDDEN(40300, "无权限"),
    AUTH_TOKEN_EXPIRED(40101, "Token已过期"),
    AUTH_TOKEN_INVALID(40102, "Token无效"),

    PARAM_INVALID(50001, "参数无效"),
    PARAM_MISSING(50002, "缺少必要参数"),
    SYSTEM_ERROR(99999, "系统内部错误");

    private final int code;
    private final String message;
}
