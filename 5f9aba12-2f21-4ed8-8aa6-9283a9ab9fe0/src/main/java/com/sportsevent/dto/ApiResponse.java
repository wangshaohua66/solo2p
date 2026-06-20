package com.sportsevent.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {

    private int code;
    private String message;
    private T data;
    private LocalDateTime timestamp = LocalDateTime.now();
    private boolean success;

    public static <T> ApiResponse<T> success(T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(200);
        response.setSuccess(true);
        response.setMessage("Success");
        response.setData(data);
        return response;
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        ApiResponse<T> response = success(data);
        response.setMessage(message);
        return response;
    }

    public static <T> ApiResponse<T> warning(String message, T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(299);
        response.setSuccess(true);
        response.setMessage(message);
        response.setData(data);
        return response;
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(code);
        response.setSuccess(false);
        response.setMessage(message);
        return response;
    }

    public static <T> ApiResponse<T> badRequest(String message) {
        return error(400, message);
    }

    public static <T> ApiResponse<T> notFound(String message) {
        return error(404, message);
    }

    public static <T> ApiResponse<T> serverError(String message) {
        return error(500, message);
    }
}
