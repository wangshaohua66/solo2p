package com.freshcommunity.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.freshcommunity.common.PageResult;
import com.freshcommunity.common.Result;
import com.freshcommunity.entity.GroupLeader;
import com.freshcommunity.service.GroupLeaderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/leader")
public class GroupLeaderController {

    @Autowired
    private GroupLeaderService groupLeaderService;

    @GetMapping("/page")
    public Result<PageResult<GroupLeader>> getLeaderPage(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) Integer status) {
        Page<GroupLeader> page = groupLeaderService.getLeaderPage(pageNum, pageSize, name, phone, status);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @GetMapping("/list")
    public Result<List<GroupLeader>> getLeaderList() {
        List<GroupLeader> list = groupLeaderService.list();
        return Result.success(list);
    }

    @GetMapping("/{id}")
    public Result<GroupLeader> getLeaderDetail(@PathVariable Long id) {
        GroupLeader leader = groupLeaderService.getLeaderDetail(id);
        return Result.success(leader);
    }

    @GetMapping("/community/{communityId}")
    public Result<GroupLeader> getLeaderByCommunityId(@PathVariable Long communityId) {
        GroupLeader leader = groupLeaderService.getLeaderByCommunityId(communityId);
        return Result.success(leader);
    }

    @PostMapping
    public Result<Void> addLeader(@RequestBody GroupLeader leader) {
        boolean success = groupLeaderService.addLeader(leader);
        return success ? Result.success() : Result.error("添加失败");
    }

    @PutMapping
    public Result<Void> updateLeader(@RequestBody GroupLeader leader) {
        boolean success = groupLeaderService.updateLeader(leader);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteLeader(@PathVariable Long id) {
        boolean success = groupLeaderService.deleteLeader(id);
        return success ? Result.success() : Result.error("删除失败");
    }
}
