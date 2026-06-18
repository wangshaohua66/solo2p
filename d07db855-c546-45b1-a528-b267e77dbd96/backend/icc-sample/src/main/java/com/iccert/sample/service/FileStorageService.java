package com.iccert.sample.service;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.IdUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class FileStorageService {

    @Value("${file.storage.path:/data/iccert/uploads}")
    private String storagePath;

    public Map<String, Object> uploadPhoto(MultipartFile file, Long sampleId, Long uploaderId) {
        try {
            String originalName = file.getOriginalFilename();
            String ext = originalName != null && originalName.contains(".")
                    ? originalName.substring(originalName.lastIndexOf(".")) : ".jpg";
            String dateDir = DateUtil.format(new java.util.Date(), "yyyyMMdd");
            String newFileName = IdUtil.fastSimpleUUID() + ext;
            Path dir = Paths.get(storagePath, "samples", dateDir);
            Files.createDirectories(dir);
            Path target = dir.resolve(newFileName);
            try (InputStream is = file.getInputStream()) {
                Files.copy(is, target, StandardCopyOption.REPLACE_EXISTING);
            }
            Map<String, Object> result = new HashMap<>();
            result.put("photoId", IdUtil.getSnowflakeNextId());
            result.put("sampleId", sampleId);
            result.put("photoUrl", "/uploads/samples/" + dateDir + "/" + newFileName);
            result.put("photoName", originalName);
            result.put("photoSize", file.getSize());
            result.put("uploadTime", new java.util.Date());
            result.put("uploaderId", uploaderId);
            log.info("样品照片上传成功: sampleId={}, url={}", sampleId, result.get("photoUrl"));
            return result;
        } catch (Exception e) {
            throw new RuntimeException("文件上传失败: " + e.getMessage(), e);
        }
    }

    public List<Map<String, Object>> uploadPhotos(MultipartFile[] files, Long sampleId, Long uploaderId) {
        List<Map<String, Object>> results = new ArrayList<>();
        for (MultipartFile f : files) {
            if (!f.isEmpty()) results.add(uploadPhoto(f, sampleId, uploaderId));
        }
        return results;
    }
}
