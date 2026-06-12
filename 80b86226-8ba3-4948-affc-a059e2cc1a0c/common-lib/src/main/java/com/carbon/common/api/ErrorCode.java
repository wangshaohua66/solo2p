package com.carbon.common.api;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {

    OK(0, "success"),

    BAD_REQUEST(40000, "请求参数错误"),
    VALIDATION_FAILED(40001, "参数校验失败"),
    UNAUTHORIZED(40100, "未授权"),
    TOKEN_EXPIRED(40101, "Token已过期"),
    TOKEN_INVALID(40102, "Token无效"),
    FORBIDDEN(40300, "禁止访问"),
    TENANT_MISMATCH(40301, "租户不匹配"),
    NOT_FOUND(40400, "资源不存在"),

    INTERNAL_ERROR(50000, "服务器内部错误"),
    SERVICE_UNAVAILABLE(50300, "服务暂不可用"),
    REMOTE_CALL_FAILED(50301, "远程服务调用失败"),

    EMISSION_SOURCE_NOT_FOUND(100100, "排放源不存在"),
    EMISSION_SOURCE_DUPLICATED(100101, "排放源编码重复"),
    ACTIVITY_DATA_VALIDATION_FAILED(100200, "活动数据校验失败"),
    ACTIVITY_DATA_IMPORT_FAILED(100201, "活动数据导入失败"),
    ACTIVITY_DATA_MISSING(100202, "活动数据缺失已插值"),

    FACTOR_NOT_FOUND(200100, "排放因子不存在"),
    FACTOR_VERSION_NOT_FOUND(200101, "因子版本不存在"),
    FACTOR_VERSION_CONFLICT(200102, "因子版本冲突"),

    CALCULATION_STANDARD_NOT_SUPPORTED(300100, "核算标准不支持"),
    CALCULATION_TASK_FAILED(300101, "核算任务执行失败"),
    CALCULATION_DIFF_ANALYSIS_FAILED(300102, "差异分析失败"),

    QUOTA_NOT_ENOUGH(400100, "配额不足"),
    QUOTA_OFFSET_EXCEED(400101, "抵消量超出限额"),
    QUOTA_ALLOCATION_FAILED(400102, "配额分配失败"),

    VERIFICATION_PACKAGE_FAILED(500100, "核查包生成失败"),
    EVIDENCE_CHAIN_BROKEN(500101, "证据链断裂"),
    VERIFICATION_SIGNATURE_FAILED(500102, "核查签注失败"),

    CCER_STATUS_TRANSITION_INVALID(600100, "CCER状态流转无效"),
    CCER_PROJECT_NOT_FOUND(600101, "CCER项目不存在"),
    CCER_ISSUE_AMOUNT_INVALID(600102, "CCER签发量无效"),

    REPORT_GENERATION_FAILED(700100, "披露报告生成失败"),
    REPORT_SIGNATURE_FAILED(700101, "数字签名失败"),

    TENANT_QUOTA_EXCEEDED(800100, "租户资源配额超限"),
    RATE_LIMIT_EXCEEDED(800200, "请求速率超限");

    private final Integer code;
    private final String message;
}
