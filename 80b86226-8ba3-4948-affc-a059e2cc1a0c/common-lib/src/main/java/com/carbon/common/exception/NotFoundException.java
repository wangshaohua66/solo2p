package com.carbon.common.exception;

import com.carbon.common.api.ErrorCode;

public class NotFoundException extends BusinessException {

    public NotFoundException(String resource, String id) {
        super(ErrorCode.NOT_FOUND, String.format("%s [%s] 不存在", resource, id));
    }

    public NotFoundException(ErrorCode errorCode, String message) {
        super(errorCode, message);
    }
}
