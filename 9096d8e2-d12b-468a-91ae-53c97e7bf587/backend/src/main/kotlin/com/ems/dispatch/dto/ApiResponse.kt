package com.ems.dispatch.dto

import java.time.LocalDateTime

data class ApiResponse<T>(
    val code: Int,
    val message: String,
    val data: T? = null,
    val timestamp: LocalDateTime = LocalDateTime.now(),
    val success: Boolean = code == 200
) {
    companion object {
        fun <T> success(data: T? = null, message: String = "Success"): ApiResponse<T> {
            return ApiResponse(200, message, data)
        }

        fun <T> error(code: Int = 500, message: String = "Internal Server Error"): ApiResponse<T> {
            return ApiResponse(code, message, null)
        }

        fun <T> badRequest(message: String = "Bad Request"): ApiResponse<T> {
            return ApiResponse(400, message, null)
        }

        fun <T> notFound(message: String = "Not Found"): ApiResponse<T> {
            return ApiResponse(404, message, null)
        }

        fun <T> unauthorized(message: String = "Unauthorized"): ApiResponse<T> {
            return ApiResponse(401, message, null)
        }

        fun <T> forbidden(message: String = "Forbidden"): ApiResponse<T> {
            return ApiResponse(403, message, null)
        }
    }
}

data class PageResponse<T>(
    val content: List<T>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
    val hasNext: Boolean,
    val hasPrevious: Boolean
)
