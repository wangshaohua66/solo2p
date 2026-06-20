package com.tvstation.media.controller;

import com.tvstation.media.common.ApiResponse;
import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.Material;
import com.tvstation.media.service.MediaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/materials")
@RequiredArgsConstructor
@Tag(name = "素材管理", description = "素材资源库相关接口")
public class MaterialController {

    private final MediaService mediaService;
    private final com.tvstation.media.service.ChunkedUploadService chunkedUploadService;

    @GetMapping
    @Operation(summary = "获取素材列表")
    public ApiResponse<PageResult<Material>> getMaterials(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int pageSize,
            @RequestParam(required = false) Material.MaterialType type,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) List<String> tags,
            @RequestParam(required = false) LocalDateTime startTime,
            @RequestParam(required = false) LocalDateTime endTime) {

        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        PageResult<Material> result = mediaService.getMaterials(type, keyword, tags, startTime, endTime, pageable);
        return ApiResponse.success(result, result.getTotal());
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取素材详情")
    public ApiResponse<Material> getMaterialDetail(@PathVariable Long id) {
        return ApiResponse.success(mediaService.getMaterialById(id));
    }

    @PostMapping("/upload")
    @Operation(summary = "上传素材")
    public ApiResponse<Material> uploadMaterial(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) List<String> tags,
            @RequestParam(required = false) String description,
            @RequestHeader("userId") Long userId,
            @RequestHeader("userName") String userName) throws Exception {

        Material material = mediaService.uploadMaterial(file, tags, description, userId, userName);
        return ApiResponse.success("上传成功", material);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新素材信息")
    public ApiResponse<Material> updateMaterial(@PathVariable Long id,
                                           @RequestBody Material material,
                                           @RequestHeader("userId") Long userId) {
        Material updated = mediaService.updateMaterial(id, material, userId);
        return ApiResponse.success("更新成功", updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除素材")
    public ApiResponse<Void> deleteMaterial(@PathVariable Long id,
                                                @RequestHeader("userId") Long userId) {
        mediaService.deleteMaterial(id, userId);
        return ApiResponse.success("删除成功", null);
    }

    @GetMapping("/check-duplicate")
    @Operation(summary = "检测重复素材")
    public ApiResponse<Map<String, Object>> checkDuplicate(@RequestParam String fileHash) {
        return ApiResponse.success(mediaService.checkDuplicate(fileHash));
    }

    @GetMapping("/{id}/download")
    @Operation(summary = "下载素材")
    public ResponseEntity<byte[]> downloadMaterial(@PathVariable Long id) throws Exception {
        Material material = mediaService.getMaterialById(id);
        byte[] data = mediaService.downloadMaterial(id);
        
        String fileName = URLEncoder.encode(material.getName() + "." + material.getFormat(), StandardCharsets.UTF_8);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }

    @GetMapping("/{id}/clip")
    @Operation(summary = "片段截取")
    public ResponseEntity<byte[]> clipMaterial(
            @PathVariable Long id,
            @RequestParam double startTime,
            @RequestParam double endTime,
            @RequestParam(defaultValue = "mp4") String format) throws Exception {

        byte[] data = mediaService.clipMaterial(id, startTime, endTime, format);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }

    @GetMapping("/{id}/preview")
    @Operation(summary = "素材预览")
    public void previewMaterial(@PathVariable Long id, HttpServletResponse response) throws IOException {
        Material material = mediaService.getMaterialById(id);
        response.setContentType("video/mp4");
        response.setHeader("Content-Disposition", "inline; filename=\"" + material.getName() + "." + material.getFormat() + "\"");
    }

    @GetMapping("/statistics")
    @Operation(summary = "素材统计")
    public ApiResponse<Map<String, Object>> getMaterialStatistics() {
        return ApiResponse.success(mediaService.getMaterialStatistics());
    }

    @PostMapping("/batch")
    @Operation(summary = "批量获取素材")
    public ApiResponse<List<Material>> getMaterialsByIds(@RequestBody List<Long> ids) {
        return ApiResponse.success(mediaService.getMaterialsByIds(ids));
    }

    @PostMapping("/upload/init")
    @Operation(summary = "初始化分片上传")
    public ApiResponse<Map<String, Object>> initChunkedUpload(
            @RequestBody Map<String, Object> body) {
        String uploadId = (String) body.get("uploadId");
        String fileName = (String) body.get("fileName");
        Long fileSize = body.get("fileSize") != null ? ((Number) body.get("fileSize")).longValue() : 0L;
        String fileType = (String) body.get("fileType");
        Integer totalChunks = body.get("totalChunks") != null ? ((Number) body.get("totalChunks")).intValue() : 0;
        Integer chunkSize = body.get("chunkSize") != null ? ((Number) body.get("chunkSize")).intValue() : 0;
        @SuppressWarnings("unchecked")
        List<String> tags = (List<String>) body.get("tags");
        String description = (String) body.get("description");

        Map<String, Object> result = chunkedUploadService.initUpload(
                uploadId, fileName, fileSize, fileType, totalChunks, chunkSize, tags, description);
        return ApiResponse.success("上传初始化成功", result);
    }

    @PostMapping("/upload/chunk")
    @Operation(summary = "上传分片")
    public ApiResponse<Map<String, Object>> uploadChunk(
            @RequestParam("file") MultipartFile file,
            @RequestParam("uploadId") String uploadId,
            @RequestParam("chunkIndex") int chunkIndex,
            @RequestParam("totalChunks") int totalChunks,
            @RequestParam("fileName") String fileName) throws IOException {

        Map<String, Object> result = chunkedUploadService.uploadChunk(
                uploadId, chunkIndex, totalChunks, fileName, file.getBytes());
        return ApiResponse.success(result);
    }

    @PostMapping("/upload/merge")
    @Operation(summary = "合并分片")
    public ApiResponse<Map<String, Object>> mergeChunks(@RequestBody Map<String, Object> body) {
        String uploadId = (String) body.get("uploadId");
        String fileName = (String) body.get("fileName");
        Long fileSize = body.get("fileSize") != null ? ((Number) body.get("fileSize")).longValue() : 0L;
        String fileType = (String) body.get("fileType");
        Integer totalChunks = body.get("totalChunks") != null ? ((Number) body.get("totalChunks")).intValue() : 0;
        @SuppressWarnings("unchecked")
        List<String> tags = (List<String>) body.get("tags");
        String description = (String) body.get("description");

        Map<String, Object> result = chunkedUploadService.mergeChunks(
                uploadId, fileName, fileSize, fileType, totalChunks, tags, description);
        return ApiResponse.success("文件合并成功", result);
    }

    @GetMapping("/upload/{uploadId}/status")
    @Operation(summary = "查询分片上传状态")
    public ApiResponse<Map<String, Object>> getUploadStatus(@PathVariable String uploadId) {
        return ApiResponse.success(chunkedUploadService.getUploadStatus(uploadId));
    }

    @DeleteMapping("/upload/{uploadId}")
    @Operation(summary = "取消分片上传")
    public ApiResponse<Void> cancelUpload(@PathVariable String uploadId) {
        chunkedUploadService.cancelUpload(uploadId);
        return ApiResponse.success("上传已取消", null);
    }
}
