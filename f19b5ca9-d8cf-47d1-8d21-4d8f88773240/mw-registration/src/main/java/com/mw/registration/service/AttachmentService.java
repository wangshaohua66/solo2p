package com.mw.registration.service;

import com.mw.common.exception.BusinessException;
import com.mw.common.response.ResultCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * 暂存状态照片附件上传：落本地磁盘并返回相对访问URL。
 * 生产环境可替换为对象存储（OSS/MinIO）实现。
 */
@Slf4j
@Service
public class AttachmentService {

    @Value("${mw.attachment.storage-dir:/tmp/mw-attachments}")
    private String storageDir;

    @Value("${mw.attachment.url-prefix:/attachments}")
    private String urlPrefix;

    public String upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上传文件为空");
        }
        String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String ext = original.contains(".") ? original.substring(original.lastIndexOf(".")) : ".jpg";
        String dateDir = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
        String fileName = UUID.randomUUID().toString().replace("-", "") + ext;
        try {
            Path dir = Paths.get(storageDir, dateDir);
            Files.createDirectories(dir);
            Path target = dir.resolve(fileName);
            file.transferTo(target.toFile());
            return urlPrefix + "/" + dateDir + "/" + fileName;
        } catch (IOException e) {
            log.error("附件上传失败", e);
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "附件上传失败");
        }
    }
}
