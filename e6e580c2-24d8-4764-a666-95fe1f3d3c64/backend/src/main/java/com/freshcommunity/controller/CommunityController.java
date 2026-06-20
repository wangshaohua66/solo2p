package com.freshcommunity.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.freshcommunity.common.PageResult;
import com.freshcommunity.common.Result;
import com.freshcommunity.entity.Community;
import com.freshcommunity.service.CommunityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/community")
public class CommunityController {

    @Autowired
    private CommunityService communityService;

    @GetMapping("/page")
    public Result<PageResult<Community>> getCommunityPage(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Integer status) {
        Page<Community> page = communityService.getCommunityPage(pageNum, pageSize, name, status);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @GetMapping("/list")
    public Result<List<Community>> getCommunityList() {
        List<Community> list = communityService.list();
        return Result.success(list);
    }

    @GetMapping("/{id}")
    public Result<Community> getCommunityDetail(@PathVariable Long id) {
        Community community = communityService.getCommunityDetail(id);
        return Result.success(community);
    }

    @PostMapping
    public Result<Void> addCommunity(@RequestBody Community community) {
        boolean success = communityService.addCommunity(community);
        return success ? Result.success() : Result.error("添加失败");
    }

    @PutMapping
    public Result<Void> updateCommunity(@RequestBody Community community) {
        boolean success = communityService.updateCommunity(community);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteCommunity(@PathVariable Long id) {
        boolean success = communityService.deleteCommunity(id);
        return success ? Result.success() : Result.error("删除失败");
    }
}
