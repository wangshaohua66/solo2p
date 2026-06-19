package com.talentmarket.common.result;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ResultCode {

    SUCCESS(200, "操作成功"),
    FAIL(500, "操作失败"),
    
    PARAM_ERROR(400, "参数错误"),
    UNAUTHORIZED(401, "未授权，请先登录"),
    FORBIDDEN(403, "没有访问权限"),
    NOT_FOUND(404, "资源不存在"),
    
    LOGIN_ERROR(1001, "用户名或密码错误"),
    TOKEN_INVALID(1002, "Token无效或已过期"),
    TOKEN_EXPIRED(1003, "Token已过期"),
    
    ENTERPRISE_NOT_APPROVED(2001, "企业尚未通过认证"),
    ENTERPRISE_ALREADY_EXISTS(2002, "企业已存在"),
    
    RESUME_NOT_FOUND(3001, "简历不存在"),
    JOB_NOT_FOUND(3002, "职位不存在"),
    
    SENSITIVE_WORD_FOUND(4001, "内容包含敏感词，请修改后重新提交"),
    
    SMS_SEND_FAILED(5001, "短信发送失败"),
    
    FILE_UPLOAD_FAILED(6001, "文件上传失败"),
    FILE_FORMAT_ERROR(6002, "文件格式不正确");

    private final Integer code;
    private final String message;
}
