package com.heritage.controller;

import com.heritage.common.ApiResponse;
import com.heritage.entity.Notification;
import com.heritage.entity.User;
import com.heritage.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@Tag(name = "用户认证与授权", description = "用户登录、注册、个人信息、消息通知API")
public class AuthController {

    @Autowired
    private UserService userService;

    @PostMapping("/login")
    @Operation(summary = "用户登录", description = "用户名密码登录，返回JWT令牌")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");
        return userService.login(username, password);
    }

    @PostMapping("/register")
    @Operation(summary = "用户注册")
    public ApiResponse<User> register(@RequestBody User user) {
        return userService.register(user);
    }

    @GetMapping("/me")
    @Operation(summary = "获取当前用户信息")
    public ApiResponse<User> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        return userService.findByUsername(username)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "用户不存在"));
    }

    @PutMapping("/me")
    @Operation(summary = "更新当前用户信息")
    public ApiResponse<User> updateCurrentUser(@RequestBody User user) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        User existing = userService.findByUsername(username).orElse(null);
        if (existing == null) {
            return ApiResponse.error(404, "用户不存在");
        }
        User updated = userService.updateUser(existing.getId(), user);
        return ApiResponse.success("更新成功", updated);
    }

    @GetMapping("/notifications")
    @Operation(summary = "获取我的消息通知")
    public ApiResponse<Page<Notification>> getNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        User user = userService.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error(404, "用户不存在");
        }

        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.success(userService.getNotifications(user.getId(), pageable));
    }

    @GetMapping("/notifications/unread-count")
    @Operation(summary = "获取未读消息数量")
    public ApiResponse<Long> getUnreadNotificationCount() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        User user = userService.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.success(0L);
        }
        return ApiResponse.success(userService.getUnreadNotificationCount(user.getId()));
    }

    @PutMapping("/notifications/{id}/read")
    @Operation(summary = "标记消息已读")
    public ApiResponse<Void> markNotificationRead(@PathVariable String id) {
        userService.markNotificationAsRead(id);
        return ApiResponse.success("已标记为已读", null);
    }

    @PutMapping("/notifications/read-all")
    @Operation(summary = "标记所有消息已读")
    public ApiResponse<Void> markAllNotificationsRead() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        User user = userService.findByUsername(username).orElse(null);
        if (user != null) {
            userService.markAllNotificationsAsRead(user.getId());
        }
        return ApiResponse.success("全部标记为已读", null);
    }
}
