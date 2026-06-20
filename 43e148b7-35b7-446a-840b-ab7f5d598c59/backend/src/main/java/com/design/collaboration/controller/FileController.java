package com.design.collaboration.controller;

import com.design.collaboration.common.ApiResponse;
import com.design.collaboration.entity.DesignVersion;
import com.design.collaboration.service.VersionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/file")
@Tag(name = "文件管理", description = "文件上传下载")
public class FileController {

    @Autowired
    private VersionService versionService;

    @PostMapping("/upload")
    @Operation(summary = "通用文件上传（不绑定版本）")
    public ApiResponse<Map<String, String>> uploadGeneral(
            @Parameter(description = "文件") @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ApiResponse.error("文件不能为空");
        }
        try {
            Path uploadDir = Paths.get("./uploads/general");
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }
            String originalFileName = file.getOriginalFilename();
            String ext = "";
            if (originalFileName != null && originalFileName.contains(".")) {
                ext = originalFileName.substring(originalFileName.lastIndexOf("."));
            }
            String storedName = UUID.randomUUID().toString() + ext;
            Path filePath = uploadDir.resolve(storedName);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            Map<String, String> result = new HashMap<>();
            result.put("fileName", originalFileName);
            result.put("storedName", storedName);
            result.put("filePath", filePath.toString());
            result.put("fileSize", String.valueOf(file.getSize()));
            return ApiResponse.success("上传成功", result);
        } catch (Exception e) {
            return ApiResponse.error("上传失败：" + e.getMessage());
        }
    }

    @GetMapping("/preview/{versionId}")
    @Operation(summary = "在线预览图纸文件")
    public ResponseEntity<Resource> preview(@Parameter(description = "版本ID") @PathVariable Long versionId) {
        DesignVersion version = versionService.findById(versionId);
        if (version == null) {
            return ResponseEntity.notFound().build();
        }
        File file = versionService.getFile(versionId);
        String fileName = URLEncoder.encode(version.getFileName(), StandardCharsets.UTF_8).replace("+", "%20");

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        String name = version.getFileName().toLowerCase();
        if (name.endsWith(".pdf")) mediaType = MediaType.APPLICATION_PDF;
        else if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) mediaType = MediaType.IMAGE_JPEG;
        else if (name.endsWith(".gif")) mediaType = MediaType.IMAGE_GIF;
        else if (name.endsWith(".txt")) mediaType = MediaType.TEXT_PLAIN;

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename*=UTF-8''" + fileName)
                .contentLength(file.length())
                .body(new FileSystemResource(file));
    }
}
