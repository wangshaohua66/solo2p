package com.heritage.controller;

import com.heritage.common.ApiResponse;
import com.heritage.entity.User;
import com.heritage.service.AdminService;
import com.heritage.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/admin")
@Tag(name = "系统管理", description = "管理后台统计报表、用户管理API")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @Autowired
    private UserService userService;

    @GetMapping("/dashboard")
    @Operation(summary = "获取首页统计数据", description = "获取非遗项目数、传承人人数、预约数等核心统计指标")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ApiResponse<Map<String, Object>> getDashboardStats() {
        return ApiResponse.success(adminService.getDashboardStats());
    }

    @GetMapping("/reports/monthly/{yearMonth}")
    @Operation(summary = "生成月度运营报告", description = "生成指定年月的运营报告，包含预约、访问量等数据")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ApiResponse<Map<String, Object>> generateMonthlyReport(@PathVariable String yearMonth) {
        return ApiResponse.success(adminService.generateMonthlyReport(yearMonth));
    }

    @GetMapping("/users")
    @Operation(summary = "查询所有用户")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<User>> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.success(userService.getAllUsers(pageable));
    }

    @GetMapping("/users/{id}")
    @Operation(summary = "获取用户详情")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ApiResponse<User> getUserById(@PathVariable String id) {
        return userService.findById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "用户不存在"));
    }

    @PutMapping("/users/{id}")
    @Operation(summary = "更新用户信息")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<User> updateUser(
            @PathVariable String id,
            @RequestBody User user) {
        User updated = userService.updateUser(id, user);
        return ApiResponse.success("更新成功", updated);
    }
}
