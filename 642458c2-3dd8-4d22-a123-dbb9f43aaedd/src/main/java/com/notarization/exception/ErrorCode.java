package com.notarization.exception;

import lombok.Getter;

@Getter
public enum ErrorCode {

    CASE_NOT_FOUND(40401, "案件不存在"),
    WORKFLOW_INVALID(40001, "工作流状态非法"),
    EVIDENCE_NOT_FOUND(40402, "证据不存在"),
    HASH_INVALID(40002, "文件哈希校验失败"),
    TRANSLATION_NOT_FOUND(40403, "翻译文档不存在"),
    UNAUTHORIZED(40100, "未授权访问"),
    CERTIFICATE_INVALID(40003, "公证书验证失败"),
    ACCESS_DENIED(40300, "访问被拒绝"),
    CONCURRENCY_LIMIT(42900, "并发请求超限"),
    PARAM_INVALID(40000, "参数校验失败");

    private final Integer code;
    private final String message;

    ErrorCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
}
