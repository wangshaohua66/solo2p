package com.freshcommunity.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.freshcommunity.common.PageResult;
import com.freshcommunity.common.Result;
import com.freshcommunity.entity.ResidentUser;
import com.freshcommunity.service.ResidentUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
public class ResidentUserController {

    @Autowired
    private ResidentUserService residentUserService;

    @GetMapping("/page")
    public Result<PageResult<ResidentUser>> getUserPage(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) Long communityId,
            @RequestParam(required = false) Integer level,
            @RequestParam(required = false) Integer status) {
        Page<ResidentUser> page = residentUserService.getUserPage(pageNum, pageSize, username, phone, communityId, level, status);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @GetMapping("/{id}")
    public Result<ResidentUser> getUserDetail(@PathVariable Long id) {
        ResidentUser user = residentUserService.getById(id);
        return Result.success(user);
    }

    @PostMapping
    public Result<Void> addUser(@RequestBody ResidentUser user) {
        boolean success = residentUserService.addUser(user);
        return success ? Result.success() : Result.error("添加失败");
    }

    @PutMapping
    public Result<Void> updateUser(@RequestBody ResidentUser user) {
        boolean success = residentUserService.updateById(user);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteUser(@PathVariable Long id) {
        boolean success = residentUserService.removeById(id);
        return success ? Result.success() : Result.error("删除失败");
    }
}
