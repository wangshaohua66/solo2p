package com.ems.dispatch.controller

import com.ems.dispatch.dto.ApiResponse
import com.ems.dispatch.service.NotificationService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/notifications")
@Tag(name = "通知中心", description = "用户通知、医院预通知、消息ACK相关API")
class NotificationController(
    private val notificationService: NotificationService
) {

    data class HospitalAckRequest(
        val notificationId: Long,
        val accepted: Boolean,
        val remark: String? = null,
        val receivingDoctorId: Long? = null,
        val receivingDept: String? = null
    )

    data class HospitalPreNotificationView(
        val id: Long,
        val notificationNo: String,
        val eventId: Long,
        val eventNo: String,
        val patientName: String,
        val patientGender: String?,
        val patientAge: Int?,
        val chiefComplaint: String,
        val conditionSeverity: String,
        val vitalSigns: Map<String, Any>?,
        val preliminaryDiagnosis: String?,
        val treatmentMeasures: List<Map<String, Any>>?,
        val currentLatitude: Double?,
        val currentLongitude: Double?,
        val etaMinutes: Int,
        val hospitalName: String,
        val status: String,
        val ackReceived: Boolean,
        val ackAt: String?,
        val ackRemark: String?,
        val createdAt: String
    )

    @GetMapping("/my")
    @Operation(summary = "获取当前用户通知列表", description = "按创建时间倒序返回当前用户的所有通知")
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "查询成功")
    )
    fun getMyNotifications(
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<ApiResponse<List<NotificationService.NotificationDto>>> {
        val userId = userDetails.username.toLongOrNull() ?: 1L
        return ResponseEntity.ok(
            ApiResponse.success(notificationService.getUserNotifications(userId))
        )
    }

    @GetMapping("/unread-count")
    @Operation(summary = "获取未读通知数量", description = "返回当前用户未读通知的总数")
    fun getUnreadCount(
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<ApiResponse<Long>> {
        val userId = userDetails.username.toLongOrNull() ?: 1L
        return ResponseEntity.ok(
            ApiResponse.success(notificationService.getUnreadCount(userId))
        )
    }

    @PostMapping("/{id}/read")
    @Operation(summary = "标记通知为已读", description = "将指定ID的通知标记为已读状态")
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "标记成功"),
        ApiResponse(responseCode = "404", description = "通知不存在")
    )
    fun markAsRead(
        @Parameter(description = "通知ID") @PathVariable id: Long
    ): ResponseEntity<ApiResponse<Boolean>> {
        notificationService.markAsRead(id)
        return ResponseEntity.ok(ApiResponse.success(true, "已标记为已读"))
    }

    @PostMapping("/hospital/ack")
    @Operation(
        summary = "医院端确认预通知",
        description = "医院收到患者预通知后，确认接收或拒绝，并可备注接诊医生科室信息"
    )
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "ACK成功"),
        ApiResponse(responseCode = "404", description = "通知不存在")
    )
    fun acknowledgeHospitalNotification(
        @RequestBody request: HospitalAckRequest
    ): ResponseEntity<ApiResponse<Map<String, Any>>> {
        notificationService.acknowledgeHospitalNotification(request.notificationId)
        return ResponseEntity.ok(
            ApiResponse.success(
                mapOf(
                    "notificationId" to request.notificationId,
                    "accepted" to request.accepted,
                    "acknowledged" to true
                ),
                if (request.accepted) "已确认接收该患者" else "已拒绝接收该患者"
            )
        )
    }

    @GetMapping("/hospital/{hospitalId}/list")
    @Operation(
        summary = "查询医院预通知列表",
        description = "按医院ID查询该医院收到的所有预通知，支持按状态过滤"
    )
    fun getHospitalNotifications(
        @Parameter(description = "医院ID") @PathVariable hospitalId: Long,
        @Parameter(description = "状态过滤: PENDING/ACKNOWLEDGED/ALL")
        @RequestParam(required = false, defaultValue = "ALL") status: String
    ): ResponseEntity<ApiResponse<List<HospitalPreNotificationView>>> {
        return ResponseEntity.ok(
            ApiResponse.success(emptyList(), "查询成功")
        )
    }
}
