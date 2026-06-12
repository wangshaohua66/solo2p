package com.carbon.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "统一响应结构")
public class R<T> implements Serializable {

    @Schema(description = "业务状态码，0表示成功", example = "0")
    private Integer code;

    @Schema(description = "消息描述", example = "success")
    private String message;

    @Schema(description = "链路追踪ID")
    private String traceId;

    @Schema(description = "业务数据")
    private T data;

    @Schema(description = "响应时间戳(ISO-8601)")
    private Instant timestamp;

    public static <T> R<T> ok() {
        return R.<T>builder()
                .code(ErrorCode.OK.getCode())
                .message(ErrorCode.OK.getMessage())
                .traceId(TraceIdHolder.get())
                .timestamp(Instant.now())
                .build();
    }

    public static <T> R<T> ok(T data) {
        return R.<T>builder()
                .code(ErrorCode.OK.getCode())
                .message(ErrorCode.OK.getMessage())
                .traceId(TraceIdHolder.get())
                .data(data)
                .timestamp(Instant.now())
                .build();
    }

    public static <T> R<T> fail(ErrorCode errorCode) {
        return R.<T>builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .traceId(TraceIdHolder.get())
                .timestamp(Instant.now())
                .build();
    }

    public static <T> R<T> fail(ErrorCode errorCode, String message) {
        return R.<T>builder()
                .code(errorCode.getCode())
                .message(message)
                .traceId(TraceIdHolder.get())
                .timestamp(Instant.now())
                .build();
    }

    public static <T> R<T> fail(Integer code, String message) {
        return R.<T>builder()
                .code(code)
                .message(message)
                .traceId(TraceIdHolder.get())
                .timestamp(Instant.now())
                .build();
    }
}
