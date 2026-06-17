package com.heritage.auth.controller;

import com.heritage.auth.common.Result;
import com.heritage.auth.entity.User;
import com.heritage.auth.enums.RoleType;
import com.heritage.auth.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    public Result<User> createUser(@RequestBody User user) {
        return Result.success(userService.createUser(user));
    }

    @PutMapping("/{id}")
    public Result<User> updateUser(@PathVariable String id, @RequestBody User user) {
        return Result.success(userService.updateUser(id, user));
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteUser(@PathVariable String id) {
        userService.deleteUser(id);
        return Result.success(null);
    }

    @GetMapping("/{id}")
    public Result<User> getUserById(@PathVariable String id) {
        return Result.success(userService.getUserById(id));
    }

    @GetMapping("/username/{username}")
    public Result<User> getUserByUsername(@PathVariable String username) {
        return Result.success(userService.getUserByUsername(username));
    }

    @GetMapping
    public Result<Page<User>> getUsers(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "createTime") String sortBy,
        @RequestParam(defaultValue = "desc") String sortDir
    ) {
        Sort sort = sortDir.equalsIgnoreCase("asc")
            ? Sort.by(sortBy).ascending()
            : Sort.by(sortBy).descending();
        return Result.success(userService.getUsers(PageRequest.of(page, size, sort)));
    }

    @GetMapping("/all")
    public Result<List<User>> getAllUsers() {
        return Result.success(userService.getAllUsers());
    }

    @GetMapping("/role/{role}")
    public Result<List<User>> getUsersByRole(@PathVariable RoleType role) {
        return Result.success(userService.getUsersByRole(role));
    }

    @PostMapping("/roles")
    public Result<List<User>> getUsersByRoles(@RequestBody Set<RoleType> roles) {
        return Result.success(userService.getUsersByRoles(roles));
    }

    @PatchMapping("/{id}/status")
    public Result<User> updateUserStatus(
        @PathVariable String id,
        @RequestParam boolean enabled
    ) {
        return Result.success(userService.updateUserStatus(id, enabled));
    }

    @PostMapping("/{id}/change-password")
    public Result<User> changePassword(
        @PathVariable String id,
        @RequestBody Map<String, String> passwords
    ) {
        return Result.success(userService.changePassword(
            id,
            passwords.get("oldPassword"),
            passwords.get("newPassword")
        ));
    }

    @PostMapping("/{id}/reset-password")
    public Result<User> resetPassword(
        @PathVariable String id,
        @RequestBody Map<String, String> body
    ) {
        return Result.success(userService.resetPassword(id, body.get("newPassword")));
    }
}
