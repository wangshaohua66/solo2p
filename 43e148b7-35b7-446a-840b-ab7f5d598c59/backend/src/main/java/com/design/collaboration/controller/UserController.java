package com.design.collaboration.controller;

import com.design.collaboration.common.ApiResponse;
import com.design.collaboration.dto.LoginRequest;
import com.design.collaboration.entity.User;
import com.design.collaboration.enums.ProfessionType;
import com.design.collaboration.enums.UserRole;
import com.design.collaboration.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/user")
@Tag(name = "用户管理", description = "用户登录、注册、CRUD接口")
public class UserController {

    @Autowired
    private UserService userService;

    @PostMapping("/login")
    @Operation(summary = "用户登录", description = "通过用户名密码登录，返回Token")
    public ApiResponse<User> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success("登录成功", userService.login(request));
    }

    @GetMapping("/me")
    @Operation(summary = "获取当前登录用户信息")
    public ApiResponse<User> getCurrentUser(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            return ApiResponse.error(401, "未登录");
        }
        User user = userService.findById(userId);
        return ApiResponse.success(user);
    }

    @GetMapping("/{id}")
    @Operation(summary = "根据ID获取用户")
    public ApiResponse<User> getById(@Parameter(description = "用户ID") @PathVariable Long id) {
        return ApiResponse.success(userService.findById(id));
    }

    @GetMapping("/list")
    @Operation(summary = "获取全部用户列表")
    public ApiResponse<List<User>> list() {
        return ApiResponse.success(userService.findAll());
    }

    @GetMapping("/role/{role}")
    @Operation(summary = "按角色获取用户列表")
    public ApiResponse<List<User>> listByRole(@Parameter(description = "角色") @PathVariable UserRole role) {
        return ApiResponse.success(userService.findByRole(role));
    }

    @GetMapping("/profession/{profession}")
    @Operation(summary = "按专业获取用户列表")
    public ApiResponse<List<User>> listByProfession(@Parameter(description = "专业") @PathVariable ProfessionType profession) {
        return ApiResponse.success(userService.findByProfession(profession));
    }

    @PostMapping
    @Operation(summary = "创建用户")
    public ApiResponse<User> create(@Valid @RequestBody User user) {
        return ApiResponse.success("创建成功", userService.create(user));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新用户")
    public ApiResponse<User> update(@Parameter(description = "用户ID") @PathVariable Long id, @Valid @RequestBody User user) {
        user.setId(id);
        return ApiResponse.success("更新成功", userService.update(user));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除用户")
    public ApiResponse<Void> delete(@Parameter(description = "用户ID") @PathVariable Long id) {
        if (userService.delete(id)) {
            return ApiResponse.success("删除成功", null);
        }
        return ApiResponse.error("删除失败");
    }
}
