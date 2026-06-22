package com.heritage.controller;

import com.heritage.common.ApiResponse;
import com.heritage.entity.Heritage;
import com.heritage.entity.MediaFile;
import com.heritage.enums.HeritageCategory;
import com.heritage.enums.HeritageLevel;
import com.heritage.service.HeritageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/heritages")
@Tag(name = "非遗项目管理", description = "非遗项目的增删改查API")
public class HeritageController {

    @Autowired
    private HeritageService heritageService;

    @GetMapping("/public/list")
    @Operation(summary = "公开查询非遗项目列表", description = "分页查询已发布的非遗项目，支持按类别、级别、地域、关键词筛选")
    public ApiResponse<Page<Heritage>> getPublicHeritages(
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "非遗类别") @RequestParam(required = false) HeritageCategory category,
            @Parameter(description = "非遗级别") @RequestParam(required = false) HeritageLevel level,
            @Parameter(description = "所属地区") @RequestParam(required = false) String region,
            @Parameter(description = "页码") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "12") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<Heritage> result = heritageService.searchHeritages(
                keyword, category, level, region, true, pageable);
        return ApiResponse.success(result);
    }

    @GetMapping("/public/{id}")
    @Operation(summary = "公开获取非遗项目详情", description = "根据ID获取非遗项目详情，浏览量+1")
    public ApiResponse<Heritage> getPublicHeritageDetail(
            @Parameter(description = "非遗项目ID") @PathVariable String id) {
        Heritage heritage = heritageService.getHeritageDetail(id);
        if (heritage == null) {
            return ApiResponse.error(404, "非遗项目不存在");
        }
        return ApiResponse.success(heritage);
    }

    @GetMapping("/public/hot")
    @Operation(summary = "获取热门非遗项目", description = "按热度排序获取热门非遗项目")
    public ApiResponse<List<Heritage>> getHotHeritages(
            @Parameter(description = "数量限制") @RequestParam(defaultValue = "10") int limit) {
        return ApiResponse.success(heritageService.getHotHeritages(limit));
    }

    @GetMapping
    @Operation(summary = "管理端查询非遗项目列表", description = "管理端查询所有非遗项目")
    public ApiResponse<Page<Heritage>> getHeritages(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) HeritageCategory category,
            @RequestParam(required = false) HeritageLevel level,
            @RequestParam(required = false) String region,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<Heritage> result = heritageService.searchHeritages(
                keyword, category, level, region, false, pageable);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取非遗项目详情")
    public ApiResponse<Heritage> getHeritageById(@PathVariable String id) {
        return heritageService.findById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "非遗项目不存在"));
    }

    @PostMapping
    @Operation(summary = "创建非遗项目")
    public ApiResponse<Heritage> createHeritage(@RequestBody Heritage heritage) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        Heritage created = heritageService.createHeritage(heritage, username);
        return ApiResponse.success("创建成功", created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新非遗项目")
    public ApiResponse<Heritage> updateHeritage(
            @PathVariable String id,
            @RequestBody Heritage heritage) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        Heritage updated = heritageService.updateHeritage(id, heritage, username);
        return ApiResponse.success("更新成功", updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除非遗项目")
    public ApiResponse<Void> deleteHeritage(@PathVariable String id) {
        heritageService.deleteHeritage(id);
        return ApiResponse.success("删除成功", null);
    }

    @PostMapping("/{id}/media")
    @Operation(summary = "添加媒体资料")
    public ApiResponse<Heritage> addMediaFile(
            @PathVariable String id,
            @RequestBody MediaFile mediaFile) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        Heritage updated = heritageService.addMediaFile(id, mediaFile, username);
        return ApiResponse.success("添加成功", updated);
    }
}
