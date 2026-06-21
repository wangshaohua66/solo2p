package com.court.execution.controller;

import com.court.execution.common.ApiResponse;
import com.court.execution.entity.User;
import com.court.execution.entity.UserRole;
import com.court.execution.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@Tag(name = "用户管理", description = "用户信息管理接口")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    @Operation(summary = "获取用户列表")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<User>> getUsers(
            @Parameter(description = "页码") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "id"));
        Page<User> users = userRepository.findAll(pageable);
        users.forEach(u -> u.setPassword(null));
        return ApiResponse.success(users);
    }

    @GetMapping("/role/{role}")
    @Operation(summary = "按角色获取用户列表")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<User>> getUsersByRole(@PathVariable UserRole role) {
        List<User> users = userRepository.findByRole(role);
        users.forEach(u -> u.setPassword(null));
        return ApiResponse.success(users);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取用户详情")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<User> getUserById(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        user.setPassword(null);
        return ApiResponse.success(user);
    }

    @PostMapping
    @Operation(summary = "新增用户")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<User> createUser(@RequestBody User user) {
        if (userRepository.existsByUsername(user.getUsername())) {
            throw new RuntimeException("用户名已存在");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setEnabled(true);
        User saved = userRepository.save(user);
        saved.setPassword(null);
        return ApiResponse.success("创建成功", saved);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新用户信息")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<User> updateUser(@PathVariable Long id, @RequestBody User user) {
        User existing = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        existing.setRealName(user.getRealName());
        existing.setRole(user.getRole());
        existing.setPhone(user.getPhone());
        existing.setEmail(user.getEmail());

        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            existing.setPassword(passwordEncoder.encode(user.getPassword()));
        }

        User saved = userRepository.save(existing);
        saved.setPassword(null);
        return ApiResponse.success("更新成功", saved);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除用户（禁用）")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        user.setEnabled(false);
        userRepository.save(user);
        return ApiResponse.success("删除成功", null);
    }

    @PutMapping("/{id}/enable")
    @Operation(summary = "启用用户")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<User> enableUser(@PathVariable Long id, @RequestParam boolean enabled) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        user.setEnabled(enabled);
        User saved = userRepository.save(user);
        saved.setPassword(null);
        return ApiResponse.success(enabled ? "已启用" : "已禁用", saved);
    }
}
