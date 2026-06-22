package com.heritage.controller;

import com.heritage.common.ApiResponse;
import com.heritage.entity.Heritage;
import com.heritage.entity.MediaFile;
import com.heritage.service.FileUploadService;
import com.heritage.service.HeritageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/files")
@Tag(name = "文件上传管理", description = "多格式文件上传与元数据自动提取API")
public class FileUploadController {

    @Autowired
    private FileUploadService fileUploadService;

    @Autowired
    private HeritageService heritageService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传文件", description = "支持图片(jpg/png/gif/webp)、视频(mp4/avi/mov)、音频(mp3/wav/flac)、文档(pdf/doc/xlsx)多格式上传，自动提取EXIF、时长等元数据")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'INHERITOR')")
    public ApiResponse<MediaFile> uploadFile(
            @Parameter(description = "上传文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "文件描述") @RequestParam(value = "description", required = false) String description) {

        if (file.isEmpty()) {
            return ApiResponse.error(400, "上传文件不能为空");
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        MediaFile mediaFile = fileUploadService.uploadFile(file, description, username);
        return ApiResponse.success("上传成功", mediaFile);
    }

    @PostMapping(value = "/upload/batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "批量上传文件", description = "一次上传多个文件，每个文件自动提取元数据")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'INHERITOR')")
    public ApiResponse<List<MediaFile>> uploadFiles(
            @Parameter(description = "上传文件列表") @RequestParam("files") MultipartFile[] files,
            @Parameter(description = "文件描述") @RequestParam(value = "description", required = false) String description) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        List<MediaFile> results = new ArrayList<>();
        for (MultipartFile file : files) {
            if (!file.isEmpty()) {
                MediaFile mediaFile = fileUploadService.uploadFile(file, description, username);
                results.add(mediaFile);
            }
        }

        return ApiResponse.success(String.format("成功上传%d个文件", results.size()), results);
    }

    @PostMapping(value = "/upload/heritage/{heritageId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传文件并关联非遗项目", description = "上传文件后自动添加到指定非遗项目的媒体资料列表中")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'INHERITOR')")
    public ApiResponse<Heritage> uploadAndAttachToHeritage(
            @Parameter(description = "非遗项目ID") @PathVariable String heritageId,
            @Parameter(description = "上传文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "文件描述") @RequestParam(value = "description", required = false) String description) {

        if (file.isEmpty()) {
            return ApiResponse.error(400, "上传文件不能为空");
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        MediaFile mediaFile = fileUploadService.uploadFile(file, description, username);
        Heritage updated = heritageService.addMediaFile(heritageId, mediaFile, username);

        return ApiResponse.success("文件上传并关联成功", updated);
    }
}
