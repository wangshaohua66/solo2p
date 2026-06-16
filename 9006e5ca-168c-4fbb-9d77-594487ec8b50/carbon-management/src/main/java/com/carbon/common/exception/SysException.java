package com.carbon.common.exception;

import lombok.Getter;

@Getter
public class SysException extends RuntimeException {

    private final int code;

    public SysException(String message) {
        super(message);
        this.code = 99999;
    }

    public SysException(int code, String message) {
        super(message);
        this.code = code;
    }

    public SysException(String message, Throwable cause) {
        super(message, cause);
        this.code = 99999;
    }
}
