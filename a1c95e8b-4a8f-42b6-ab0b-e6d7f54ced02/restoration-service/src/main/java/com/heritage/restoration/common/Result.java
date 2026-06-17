package com.heritage.restoration.common;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> implements Serializable {
    private Boolean success;
    private Integer code;
    private String message;
    private T data;
    private Long timestamp;

    public static <T> Result<T> ok(T data) {
        return Result.<T>builder()
                .success(true).code(200).message("操作成功")
                .data(data).timestamp(System.currentTimeMillis()).build();
    }

    public static <T> Result<T> ok() { return ok(null); }

    public static <T> Result<T> fail(String message) {
        return fail(500, message);
    }

    public static <T> Result<T> fail(Integer code, String message) {
        return Result.<T>builder()
                .success(false).code(code).message(message)
                .timestamp(System.currentTimeMillis()).build();
    }
}
