package com.emergency.notification.controller;

import com.emergency.common.result.Result;
import com.emergency.common.util.SecurityUtils;
import com.emergency.notification.dto.NotificationSendRequest;
import com.emergency.notification.entity.Notification;
import com.emergency.notification.entity.NotificationReceipt;
import com.emergency.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@Tag(name = "预警通知管理", description = "预警通知推送、回执追踪接口")
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping("/send")
    @Operation(summary = "发送通知")
    public Result<Long> sendNotification(@Valid @RequestBody NotificationSendRequest request) {
        return Result.success(notificationService.sendNotification(request));
    }

    @PostMapping("/send-incident-alert")
    @Operation(summary = "发送灾情预警通知")
    public Result<Long> sendIncidentAlert(@Parameter(description = "灾情ID") @RequestParam Long incidentId) {
        return Result.success(notificationService.sendIncidentAlert(incidentId));
    }

    @PostMapping("/broadcast")
    @Operation(summary = "广播通知")
    public Result<List<Long>> broadcastNotification(
            @Parameter(description = "标题") @RequestParam String title,
            @Parameter(description = "内容") @RequestParam String content,
            @Parameter(description = "区域编码") @RequestParam(required = false) String regionCode,
            @Parameter(description = "灾情等级") @RequestParam(required = false) Integer incidentLevel) {
        return Result.success(notificationService.broadcastNotification(title, content, regionCode, incidentLevel));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取通知详情")
    public Result<Notification> getNotificationById(@PathVariable Long id) {
        return Result.success(notificationService.getNotificationById(id));
    }

    @GetMapping("/no/{notificationNo}")
    @Operation(summary = "根据编号获取通知")
    public Result<Notification> getNotificationByNo(@PathVariable String notificationNo) {
        return Result.success(notificationService.getNotificationByNo(notificationNo));
    }

    @GetMapping("/incident/{incidentId}")
    @Operation(summary = "获取灾情关联的通知")
    public Result<List<Notification>> getNotificationsByIncidentId(@PathVariable Long incidentId) {
        return Result.success(notificationService.getNotificationsByIncidentId(incidentId));
    }

    @GetMapping("/{id}/receipts")
    @Operation(summary = "获取通知回执列表")
    public Result<List<NotificationReceipt>> getReceipts(@PathVariable Long id) {
        return Result.success(notificationService.getReceiptsByNotificationId(id));
    }

    @GetMapping("/my")
    @Operation(summary = "获取我的通知")
    public Result<List<Notification>> getMyNotifications(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        Long userId = SecurityUtils.getCurrentUserId();
        return Result.success(notificationService.getUserNotifications(userId, pageNum, pageSize));
    }

    @PostMapping("/receipts/{id}/confirm")
    @Operation(summary = "确认通知已读")
    public Result<Boolean> confirmReceipt(@PathVariable Long id) {
        return Result.success(notificationService.confirmReceipt(id));
    }

    @PostMapping("/process-pending")
    @Operation(summary = "处理待发送通知")
    public Result<Void> processPendingNotifications() {
        notificationService.processPendingNotifications();
        return Result.success();
    }
}
