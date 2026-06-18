package com.wedding.suite.exception;

public enum ErrorCode {
    SUCCESS(0),
    BAD_REQUEST(400),
    UNAUTHORIZED(401),
    FORBIDDEN(403),
    NOT_FOUND(404),
    CONFLICT(409),
    VALIDATION_ERROR(422),
    BUSINESS_ERROR(1000),
    SCHEDULE_CONFLICT(1001),
    SMS_SEND_FAILED(2001),
    SIGN_INIT_FAILED(3001),
    EXPORT_FAILED(4001);

    private final int code;

    ErrorCode(int code) { this.code = code; }

    public int code() { return code; }
}
