package com.design.collaboration.controller;

import com.design.collaboration.common.ApiResponse;
import com.design.collaboration.entity.DesignVersion;
import com.design.collaboration.service.VersionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/version")
@Tag(name = "版本管理", description = "图纸版本上传、下载、发布、对比")
public class VersionController {

    @Autowired
    private VersionService versionService;

    @GetMapping("/{id}")
    @Operation(summary = "获取版本详情")
    public ApiResponse<DesignVersion> getById(@Parameter(description = "版本ID") @PathVariable Long id) {
        DesignVersion version = versionService.findById(id);
        if (version == null) {
            return ApiResponse.error("版本不存在");
        }
        return ApiResponse.success(version);
    }

    @GetMapping("/list")
    @Operation(summary = "版本列表查询")
    public ApiResponse<List<DesignVersion>> list(
            @Parameter(description = "项目ID") @RequestParam(required = false) Long projectId,
            @Parameter(description = "任务ID") @RequestParam(required = false) Long taskId,
            @Parameter(description = "仅已发布") @RequestParam(required = false, defaultValue = "false") Boolean onlyReleased) {
        return ApiResponse.success(versionService.findByConditions(projectId, taskId, onlyReleased));
    }

    @PostMapping("/upload")
    @Operation(summary = "上传图纸新版本")
    public ApiResponse<DesignVersion> upload(
            @Parameter(description = "项目ID") @RequestParam Long projectId,
            @Parameter(description = "任务ID") @RequestParam(required = false) Long taskId,
            @Parameter(description = "文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "修改说明") @RequestParam(required = false) String description,
            HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("上传成功", versionService.upload(projectId, taskId, file, description, userId));
    }

    @GetMapping("/{id}/download")
    @Operation(summary = "下载图纸文件")
    public ResponseEntity<Resource> download(@Parameter(description = "版本ID") @PathVariable Long id) {
        DesignVersion version = versionService.findById(id);
        if (version == null) {
            return ResponseEntity.notFound().build();
        }
        File file = versionService.getFile(id);
        String fileName = URLEncoder.encode(version.getFileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName)
                .contentLength(file.length())
                .body(new FileSystemResource(file));
    }

    @PostMapping("/{id}/release")
    @Operation(summary = "发布版本（客户可见）")
    public ApiResponse<DesignVersion> release(@Parameter(description = "版本ID") @PathVariable Long id, HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("发布成功", versionService.release(id, userId));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除版本（不推荐，历史版本不可删除）")
    @Deprecated
    public ApiResponse<Void> delete(@Parameter(description = "版本ID") @PathVariable Long id) {
        if (versionService.delete(id)) {
            return ApiResponse.success("删除成功", null);
        }
        return ApiResponse.error("删除失败");
    }

    @GetMapping("/compare")
    @Operation(summary = "两版本信息对比（返回两版本完整信息）")
    public ApiResponse<List<DesignVersion>> compare(
            @Parameter(description = "版本1ID") @RequestParam Long v1Id,
            @Parameter(description = "版本2ID") @RequestParam Long v2Id) {
        DesignVersion v1 = versionService.findById(v1Id);
        DesignVersion v2 = versionService.findById(v2Id);
        if (v1 == null || v2 == null) {
            return ApiResponse.error("版本不存在");
        }
        return ApiResponse.success(List.of(v1, v2));
    }
}
