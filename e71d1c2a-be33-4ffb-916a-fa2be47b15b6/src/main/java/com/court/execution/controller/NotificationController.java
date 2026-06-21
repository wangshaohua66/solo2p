package com.court.execution.controller;

import com.court.execution.common.ApiResponse;
import com.court.execution.entity.Notification;
import com.court.execution.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "通知管理", description = "站内通知查询、标记已读等接口")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/my")
    @Operation(summary = "获取我的通知", description = "获取当前登录用户的所有通知，按时间倒序")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Notification>> getMyNotifications() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        List<Notification> notifications = notificationService.getNotificationsByUsername(username);
        return ApiResponse.success(notifications);
    }

    @GetMapping("/my/unread")
    @Operation(summary = "获取我的未读通知", description = "获取当前登录用户的未读通知")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Notification>> getMyUnreadNotifications() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        List<Notification> notifications = notificationService.getUnreadNotificationsByUsername(username);
        return ApiResponse.success(notifications);
    }

    @GetMapping("/my/unread-count")
    @Operation(summary = "获取未读通知数量", description = "获取当前登录用户的未读通知数量")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Long> getMyUnreadCount() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        long count = notificationService.countUnreadByUsername(username);
        return ApiResponse.success(count);
    }

    @PutMapping("/{notificationId}/read")
    @Operation(summary = "标记通知已读", description = "将指定通知标记为已读")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Void> markAsRead(@PathVariable Long notificationId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        notificationService.markAsRead(notificationId, username);
        return ApiResponse.success("已标记为已读");
    }

    @PutMapping("/my/read-all")
    @Operation(summary = "全部标记已读", description = "将当前用户所有未读通知标记为已读")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Integer> markAllAsRead() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        int count = notificationService.markAllAsRead(username);
        return ApiResponse.success("已全部标记为已读，共" + count + "条", count);
    }
}
