package com.wedding.suite.controller;

import com.wedding.suite.common.AuthUtil;
import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.entity.NotificationEntity;
import com.wedding.suite.service.impl.NotificationServiceImpl;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationServiceImpl notificationService;

    public NotificationController(NotificationServiceImpl notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping(value = "/sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe() {
        Long userId = AuthUtil.currentUserId();
        if (userId == null) userId = 0L;
        return notificationService.register(userId);
    }

    @GetMapping
    public ApiResponse<List<NotificationEntity>> listMine() {
        return ApiResponse.ok(notificationService.listMine(AuthUtil.require().getId()));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Map<String, Long>> unreadCount() {
        return ApiResponse.ok(Map.of("count", notificationService.unreadCount(AuthUtil.require().getId())));
    }

    @PutMapping("/{id}/read")
    public ApiResponse<Void> markRead(@PathVariable Long id) {
        notificationService.markRead(id);
        return ApiResponse.ok();
    }

    @PutMapping("/read-all")
    public ApiResponse<Void> markAllRead() {
        notificationService.markAllRead(AuthUtil.require().getId());
        return ApiResponse.ok();
    }
}
